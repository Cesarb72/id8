import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { appendFile, mkdir, mkdtemp, rename, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { platform, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  canonicalHostedValidationUrl,
  getHostedValidationUrl,
  readVercelProtectionBypassSecret,
} from './hostedValidationKit.js'

const defaultDebugPort = 9339
const fieldProxyPath = '/api/field/text-search'
const stepBSupplyTracePrefix = '[ID8 STEP B SUPPLY TRACE]'
const providerPatterns = [
  'places.googleapis.com',
  'VITE_GOOGLE_PLACES_API_KEY',
  'X-Goog-Api-Key',
  'X-Goog-FieldMask',
] as const

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

interface CdpClient {
  onOpen: Promise<void>
  send<T = Record<string, unknown>>(method: string, params?: Record<string, unknown>): Promise<T>
  on(method: string, listener: (params: Record<string, unknown>) => void): () => void
  close(): Promise<void>
}

interface NetworkRequestSummary {
  requestId: string
  url: string
  method: string
  path: string
  isFieldProxy: boolean
  queryLabel: string | null
  status: number | null
  type: string | null
  failed: boolean
  failureReason: string | null
}

interface FieldProxyCallSummary extends NetworkRequestSummary {
  cache: JsonValue
  callConsumed: JsonValue
  providerStatus: JsonValue
  budget: JsonValue
  resultCount: JsonValue
  responseQueryLabel: JsonValue
  candidateSummaries: JsonValue
}

interface EvidenceState {
  artifactDir: string
  startedAt: string
  completedAt: string | null
  dryRun: boolean
  targetUrl: string
  checkpoints: Array<Record<string, JsonValue>>
  consoleEvents: Array<Record<string, JsonValue>>
  pageErrors: Array<Record<string, JsonValue>>
  failedRequests: Array<Record<string, JsonValue>>
  networkRequests: NetworkRequestSummary[]
  fieldProxyCalls: FieldProxyCallSummary[]
  stepBSupplyTraces: Array<Record<string, JsonValue>>
  providerPatternHits: Array<Record<string, JsonValue>>
  routeSourceEvidence: Array<Record<string, JsonValue>>
  candidateEvidence: Array<Record<string, JsonValue>>
  stepBDiagnosticEvidence: Array<Record<string, JsonValue>>
  routeCardsBeforeClick: Array<Record<string, JsonValue>>
  selectedRouteCard: Record<string, JsonValue> | null
  revealedRouteText: string | null
  finalError: string | null
}

function isoNow(): string {
  return new Date().toISOString()
}

function truncate(value: string, maxLength = 4000): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...<truncated>` : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeForEvidence(value: unknown, depth = 0): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return truncate(value)
  }
  if (depth > 6) {
    return '<max-depth>'
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => sanitizeForEvidence(entry, depth + 1))
  }
  if (!isRecord(value)) {
    return String(value)
  }

  const sanitized: Record<string, JsonValue> = {}
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase()
    if (
      normalizedKey.includes('secret') ||
      normalizedKey.includes('token') ||
      normalizedKey.includes('cookie') ||
      normalizedKey.includes('authorization') ||
      normalizedKey.includes('header') ||
      normalizedKey.includes('bypass') ||
      normalizedKey.includes('api_key') ||
      normalizedKey.includes('apikey')
    ) {
      sanitized[key] = '<redacted>'
      continue
    }
    sanitized[key] = sanitizeForEvidence(entry, depth + 1)
  }
  return sanitized
}

function safeUrlPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

function scanProviderPatterns(source: string): string[] {
  return providerPatterns.filter((pattern) => source.includes(pattern))
}

function getNestedValue(value: unknown, keys: string[]): unknown {
  if (!isRecord(value)) {
    return null
  }
  let current: unknown = value
  for (const key of keys) {
    if (!isRecord(current) || !(key in current)) {
      return null
    }
    current = current[key]
  }
  return current
}

function findFirstValue(value: unknown, paths: string[][]): JsonValue {
  for (const path of paths) {
    const candidate = getNestedValue(value, path)
    if (candidate !== null && candidate !== undefined) {
      return sanitizeForEvidence(candidate)
    }
  }
  return null
}

function findStringValue(value: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const candidate = getNestedValue(value, path)
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

function findArrayValue(value: unknown, paths: string[][]): string[] {
  for (const path of paths) {
    const candidate = getNestedValue(value, path)
    if (!Array.isArray(candidate)) {
      continue
    }
    return candidate
      .filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
      .slice(0, 10)
  }
  return []
}

function hasCoffeeBooksSemanticSignal(entry: unknown): boolean {
  const corpus = [
    findStringValue(entry, [['name'], ['displayName'], ['venue', 'name'], ['title']]),
    findStringValue(entry, [['category'], ['venueCategory'], ['venue', 'category']]),
    findStringValue(entry, [['subcategory'], ['venueSubcategory'], ['venue', 'subcategory']]),
    findStringValue(entry, [['shortDescription'], ['description'], ['venue', 'shortDescription']]),
    ...findArrayValue(entry, [['tags'], ['venueTags'], ['venue', 'tags']]),
    ...findArrayValue(entry, [['sourceTypes'], ['types'], ['venue', 'sourceTypes']]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
  return /\b(book|books|book shop|bookshop|bookstore|reading|literary|library|museum|gallery|art|exhibit|exhibition)\b/.test(
    corpus,
  ) || /\bcultural\s+(center|venue)\b/.test(corpus)
}

function extractCandidateSummaries(parsed: unknown): JsonValue {
  const candidates =
    getNestedValue(parsed, ['results']) ??
    getNestedValue(parsed, ['venues']) ??
    getNestedValue(parsed, ['data', 'results']) ??
    getNestedValue(parsed, ['data', 'venues'])
  if (!Array.isArray(candidates)) {
    return []
  }
  return candidates.slice(0, 5).map((entry, index) =>
    sanitizeForEvidence({
      index,
      name: findStringValue(entry, [['name'], ['displayName'], ['venue', 'name'], ['title']]),
      category: findStringValue(entry, [['category'], ['venueCategory'], ['venue', 'category']]),
      subcategory: findStringValue(entry, [
        ['subcategory'],
        ['venueSubcategory'],
        ['venue', 'subcategory'],
      ]),
      sourceLabel: findStringValue(entry, [
        ['sourceLabel'],
        ['source', 'label'],
        ['source', 'sourceOrigin'],
        ['venue', 'source', 'sourceOrigin'],
      ]),
      tags: findArrayValue(entry, [['tags'], ['venueTags'], ['venue', 'tags']]),
      sourceTypes: findArrayValue(entry, [['sourceTypes'], ['types'], ['venue', 'sourceTypes']]),
      semanticEvidencePresent: hasCoffeeBooksSemanticSignal(entry),
      survivedCandidateBoardFiltering: null,
      roleFit: findFirstValue(entry, [['roleFit'], ['scores', 'roleFit'], ['venue', 'roleFit']]),
      score: findFirstValue(entry, [['score'], ['fitScore'], ['rankScore']]),
    }),
  )
}

function extractQueryLabel(source: unknown): string | null {
  if (!source) {
    return null
  }
  if (typeof source === 'string') {
    try {
      return extractQueryLabel(JSON.parse(source))
    } catch {
      const semanticLabel = source.match(/coffee-books-[a-z-]+/i)?.[0]
      if (semanticLabel) {
        return semanticLabel
      }
      return source.match(/[a-z-]+-intent@core/i)?.[0] ?? null
    }
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      const label = extractQueryLabel(entry)
      if (label) {
        return label
      }
    }
    return null
  }
  if (!isRecord(source)) {
    return null
  }
  for (const key of ['queryLabel', 'label', 'intentLabel', 'requestLabel']) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  for (const entry of Object.values(source)) {
    const label = extractQueryLabel(entry)
    if (label) {
      return label
    }
  }
  return null
}

function summarizeFieldProxyBody(body: string): Omit<
  FieldProxyCallSummary,
  keyof NetworkRequestSummary
> {
  let parsed: unknown = null
  try {
    parsed = JSON.parse(body)
  } catch {
    return {
      cache: null,
      callConsumed: null,
      providerStatus: null,
      budget: null,
      resultCount: null,
      responseQueryLabel: null,
      candidateSummaries: [],
    }
  }

  const resultCount =
    Array.isArray(getNestedValue(parsed, ['results']))
      ? (getNestedValue(parsed, ['results']) as unknown[]).length
      : Array.isArray(getNestedValue(parsed, ['venues']))
        ? (getNestedValue(parsed, ['venues']) as unknown[]).length
        : findFirstValue(parsed, [['resultCount'], ['metadata', 'resultCount']])

  return {
    cache: findFirstValue(parsed, [['cache'], ['cached'], ['metadata', 'cache']]),
    callConsumed: findFirstValue(parsed, [
      ['callConsumed'],
      ['governance', 'callConsumed'],
      ['metadata', 'callConsumed'],
    ]),
    providerStatus: findFirstValue(parsed, [
      ['providerStatus'],
      ['provider', 'status'],
      ['metadata', 'providerStatus'],
    ]),
    budget: findFirstValue(parsed, [
      ['budget'],
      ['governance', 'budget'],
      ['metadata', 'budget'],
    ]),
    resultCount: sanitizeForEvidence(resultCount),
    responseQueryLabel: sanitizeForEvidence(extractQueryLabel(parsed)),
    candidateSummaries: extractCandidateSummaries(parsed),
  }
}

let atomicWriteCounter = 0

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  atomicWriteCounter += 1
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.${atomicWriteCounter}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, path)
}

async function durableWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function createSerializedWriteQueue(): (operation: () => Promise<void>) => Promise<void> {
  let queue = Promise.resolve()
  return async (operation: () => Promise<void>): Promise<void> => {
    const nextWrite = queue.then(operation, operation)
    queue = nextWrite.catch(() => undefined)
    await nextWrite
  }
}

async function appendNdjson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(value)}\n`, 'utf8')
}

function createCdpClient(webSocketUrl: string): CdpClient {
  const socket = new WebSocket(webSocketUrl)
  let nextId = 1
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  const events = new Map<string, Array<(params: Record<string, unknown>) => void>>()

  const onOpen = new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve())
    socket.addEventListener('error', (event) => reject(new Error(`WebSocket error: ${event.type}`)))
  })

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number
      method?: string
      params?: Record<string, unknown>
      result?: unknown
      error?: { message?: string }
    }
    if (typeof message.id === 'number') {
      const entry = pending.get(message.id)
      if (!entry) {
        return
      }
      pending.delete(message.id)
      if (message.error) {
        entry.reject(new Error(message.error.message ?? 'CDP command failed'))
      } else {
        entry.resolve(message.result ?? {})
      }
      return
    }
    if (message.method) {
      for (const listener of events.get(message.method) ?? []) {
        listener(message.params ?? {})
      }
    }
  })

  async function send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    await onOpen
    const id = nextId++
    const promise = new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })
    })
    socket.send(JSON.stringify({ id, method, params }))
    return promise
  }

  return {
    onOpen,
    send,
    on(method, listener) {
      const listeners = events.get(method) ?? []
      listeners.push(listener)
      events.set(method, listeners)
      return () => {
        const nextListeners = (events.get(method) ?? []).filter((entry) => entry !== listener)
        if (nextListeners.length === 0) {
          events.delete(method)
        } else {
          events.set(method, nextListeners)
        }
      }
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    },
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return (await response.json()) as T
}

function getChromeCandidates(): string[] {
  const explicitPath = process.env.ID8_CHROME_PATH?.trim()
  const candidates = explicitPath ? [explicitPath] : []
  if (platform() === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    )
  } else if (platform() === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    )
  } else {
    candidates.push('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser')
  }
  return candidates
}

function resolveChromeExecutable(): string {
  for (const candidate of getChromeCandidates()) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (existsSync(candidate)) {
        return candidate
      }
      continue
    }
    return candidate
  }
  throw new Error('Chrome/Edge executable not found. Set ID8_CHROME_PATH to the browser binary.')
}

async function launchChrome(port: number): Promise<{
  process: ChildProcessWithoutNullStreams
  profileDir: string
}> {
  const profileDir = await mkdtemp(join(tmpdir(), 'id8-stepb-observer-chrome-'))
  const executable = resolveChromeExecutable()
  const browserProcess = spawn(
    executable,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--disable-background-networking',
      '--disable-default-apps',
      '--new-window',
      'about:blank',
    ],
    { stdio: 'pipe' },
  )
  browserProcess.on('error', (error) => {
    process.stderr.write(`Browser process error: ${error.message}\n`)
  })
  return { process: browserProcess, profileDir }
}

async function waitForDebugger(port: number, timeoutMs = 10000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetchJson<unknown>(`http://127.0.0.1:${port}/json/version`)
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error(`Timed out waiting for browser debugger on port ${port}.`)
}

async function createTarget(port: number, url: string): Promise<{ id: string; webSocketDebuggerUrl: string }> {
  return fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  })
}

async function closeTarget(port: number, targetId: string): Promise<void> {
  await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`).catch(() => undefined)
}

async function evaluate<T>(cdp: CdpClient, expression: string): Promise<T> {
  const result = await cdp.send<{
    result?: { value?: T }
    exceptionDetails?: { text?: string }
  }>('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Runtime evaluation failed.')
  }
  return result.result?.value as T
}

async function collectPageSnapshot(cdp: CdpClient): Promise<Record<string, JsonValue>> {
  return evaluate<Record<string, JsonValue>>(
    cdp,
    `
      (() => {
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const visible = (element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        }
        const buttons = Array.from(document.querySelectorAll('button'))
          .filter(visible)
          .map((button) => normalize(button.innerText || button.getAttribute('aria-label')))
          .filter(Boolean)
          .slice(0, 30)
        const cardElements = Array.from(document.querySelectorAll('button.step2-night-option, .step2-night-option'))
          .filter(visible)
        return {
          url: location.href,
          title: document.title,
          bodyText: normalize(document.body?.innerText).slice(0, 5000),
          visibleButtons: buttons,
          routeCardCount: cardElements.length,
          reviewButtonPresent: buttons.some((text) => /review this route/i.test(text)),
          continueButtonPresent: buttons.some((text) => /^continue$/i.test(text)),
        }
      })()
    `,
  )
}

async function readRouteCards(cdp: CdpClient): Promise<Array<Record<string, JsonValue>>> {
  return evaluate<Array<Record<string, JsonValue>>>(
    cdp,
    `
      (() => {
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const visible = (element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        }
        const selectors = [
          'button.step2-night-option',
          '.step2-night-options-grid button',
          'button.district-card',
          '[class*="night-option"] button',
        ]
        const seen = new Set()
        const cards = []
        for (const selector of selectors) {
          for (const element of Array.from(document.querySelectorAll(selector))) {
            if (seen.has(element) || !visible(element)) {
              continue
            }
            seen.add(element)
            const rect = element.getBoundingClientRect()
            const text = normalize(element.innerText || element.getAttribute('aria-label'))
            cards.push({
              index: cards.length,
              selector,
              artifactId: element.getAttribute('data-id8-route-card-artifact-id') || null,
              sourceOpportunityId:
                element.getAttribute('data-id8-route-card-source-opportunity-id') || null,
              cardDisplaySource:
                element.getAttribute('data-id8-route-card-display-source') || null,
              text,
              disabled: Boolean(element.disabled),
              ariaPressed: element.getAttribute('aria-pressed'),
              rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            })
          }
        }
        return cards
      })()
    `,
  )
}

async function readRouteSourceEvidence(cdp: CdpClient): Promise<Record<string, JsonValue>> {
  return evaluate<Record<string, JsonValue>>(
    cdp,
    `
      (() => {
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const bodyText = normalize(document.body?.innerText)
        const summaryElement = document.querySelector('[data-id8-route-summary-source], [data-id8-route-summary-suppressed]')
        const summaryText = summaryElement ? normalize(summaryElement.innerText || summaryElement.textContent) : null
        const summarySuppressedRaw = summaryElement?.getAttribute('data-id8-route-summary-suppressed') || null
        const summarySemanticStatus = summaryElement?.getAttribute('data-id8-route-summary-semantic-status') || null
        const summaryRejectionReason = summaryElement?.getAttribute('data-id8-route-summary-rejection-reason') || null
        const activeStarterIdForSemanticAdmission = summaryElement?.getAttribute('data-id8-route-summary-active-starter-id') || null
        const semanticEvidenceRaw = summaryElement?.getAttribute('data-id8-route-summary-semantic-evidence') || '[]'
        let matchedSemanticEvidence = []
        try {
          const parsed = JSON.parse(semanticEvidenceRaw)
          matchedSemanticEvidence = Array.isArray(parsed) ? parsed : []
        } catch {
          matchedSemanticEvidence = []
        }
        const reviewButtonVisible = Array.from(document.querySelectorAll('button, [role="button"]'))
          .some((element) => {
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
            return visible && normalize(element.innerText || element.getAttribute('aria-label')).toLowerCase().includes('review this route')
          })
        const sourceLine = bodyText.match(/Highlight source:[^.]+\\./i)?.[0] || null
        const lineageMatch = bodyText.match(/committed_route_fallback|approved_payload|candidate_draft|committed runtime route|candidate route story spine/i)?.[0] || null
        const routeStopMatches = Array.from(bodyText.matchAll(/\\b(START|HIGHLIGHT|WIND-DOWN)\\s+([^\\n]+?)(?=\\s+(?:cafe|dessert|museum|restaurant|bar|activity|park|live music|WHERE THIS NIGHT LIVES|START|HIGHLIGHT|WIND-DOWN|$))/gi))
          .slice(0, 5)
          .map((match) => ({
            role: normalize(match[1]),
            text: normalize(match[2]),
          }))
        const semanticTerms = ['book', 'books', 'bookshop', 'bookstore', 'reading', 'literary', 'library', 'museum', 'gallery', 'art gallery', 'exhibit', 'exhibition', 'cultural center', 'cultural venue']
        const lowerBody = bodyText.toLowerCase()
        return {
          url: location.href,
          visibleRouteSummaryText: summaryText,
          selectedRouteSummaryArtifactSource: summaryElement?.getAttribute('data-id8-route-summary-source') || null,
          selectedRouteSummaryArtifactProvenance: summaryElement?.getAttribute('data-id8-route-summary-provenance') || null,
          selectedRouteArtifactCanonicalRouteSource: summaryElement?.getAttribute('data-id8-route-summary-rendered-route-source') || null,
          activeStarterIdForSemanticAdmission,
          routeSummarySuppressed: summarySuppressedRaw === 'true',
          routeSummarySuppressionReason: summaryRejectionReason && summaryRejectionReason !== 'none' ? summaryRejectionReason : null,
          routeSummarySemanticRepresentationStatus: summarySemanticStatus,
          routeSummaryPassedStarterSemanticRepresentation:
            summarySemanticStatus === 'represented' ||
            (summarySemanticStatus === 'not_applicable' && activeStarterIdForSemanticAdmission !== 'coffee-books'),
          reviewCtaVisible: reviewButtonVisible,
          sourceLine,
          lineageHint: lineageMatch,
          routeStops: routeStopMatches,
          matchedSemanticEvidence,
          bodySemanticSubstringHits: semanticTerms.filter((term) => lowerBody.includes(term)),
          bodyExcerpt: bodyText.slice(0, 2500),
        }
      })()
    `,
  )
}

async function readStepBCoffeeBooksDiagnostics(cdp: CdpClient): Promise<Record<string, JsonValue>> {
  return evaluate<Record<string, JsonValue>>(
    cdp,
    `
      (() => {
        const element = document.querySelector('[data-id8-step-b-coffee-books-diagnostics]')
        if (!element) {
          return {
            present: false,
            diagnostic: null,
          }
        }
        const raw = element.getAttribute('data-id8-step-b-coffee-books-diagnostics') || '{}'
        try {
          return {
            present: true,
            diagnostic: JSON.parse(raw),
          }
        } catch (error) {
          return {
            present: true,
            diagnostic: null,
            parseError: error instanceof Error ? error.message : String(error),
          }
        }
      })()
    `,
  )
}

async function clickTextButton(cdp: CdpClient, label: string): Promise<Record<string, JsonValue>> {
  return evaluate<Record<string, JsonValue>>(
    cdp,
    `
      (() => {
        const label = ${JSON.stringify(label)}
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const visible = (element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        }
        const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
          .filter(visible)
          .map((element, index) => ({
            element,
            index,
            text: normalize(element.innerText || element.getAttribute('aria-label')),
          }))
          .filter((entry) => entry.text.toLowerCase().includes(label.toLowerCase()))
        const exact = candidates.find((entry) => entry.text.toLowerCase() === label.toLowerCase())
        const selected = exact || candidates[0]
        if (!selected) {
          return { ok: false, label, visibleButtons: Array.from(document.querySelectorAll('button')).filter(visible).map((button) => normalize(button.innerText || button.getAttribute('aria-label'))).filter(Boolean) }
        }
        selected.element.scrollIntoView({ block: 'center', inline: 'center' })
        selected.element.click()
        return { ok: true, label, selectedText: selected.text, selectedIndex: selected.index }
      })()
    `,
  )
}

async function selectCoffeeBooksStarter(cdp: CdpClient): Promise<Record<string, JsonValue>> {
  return evaluate<Record<string, JsonValue>>(
    cdp,
    `
      (() => {
        const label = 'Coffee & Books'
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const visible = (element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        }
        const selectors = [
          'button',
          '[role="button"]',
          'label',
          '[class*="starter"]',
          '[class*="pack"]',
        ]
        const seen = new Set()
        const candidates = []
        for (const selector of selectors) {
          for (const element of Array.from(document.querySelectorAll(selector))) {
            if (seen.has(element) || !visible(element)) {
              continue
            }
            seen.add(element)
            const text = normalize(element.innerText || element.textContent || element.getAttribute('aria-label'))
            if (text.toLowerCase().includes(label.toLowerCase())) {
              candidates.push({ element, selector, text })
            }
          }
        }
        const selected = candidates.find((entry) => /^coffee & books$/i.test(entry.text)) || candidates[0]
        if (!selected) {
          return { ok: false, label, candidates: [] }
        }
        const clickable = selected.element.closest('button, [role="button"], label') || selected.element
        clickable.scrollIntoView({ block: 'center', inline: 'center' })
        clickable.click()
        return {
          ok: true,
          label,
          selector: selected.selector,
          selectedText: selected.text,
          candidateCount: candidates.length,
        }
      })()
    `,
  )
}

async function clickRouteCard(
  cdp: CdpClient,
  index: number,
  artifactId?: string | null,
): Promise<Record<string, JsonValue>> {
  return evaluate<Record<string, JsonValue>>(
    cdp,
    `
      (() => {
        const index = ${index}
        const expectedArtifactId = ${JSON.stringify(artifactId ?? null)}
        const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
        const visible = (element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        }
        const selectors = [
          'button.step2-night-option:not([disabled])',
          'button.step2-night-option',
          '.step2-night-options-grid button',
          'button.district-card',
        ]
        const seen = new Set()
        const candidates = []
        for (const selector of selectors) {
          for (const element of Array.from(document.querySelectorAll(selector))) {
            if (seen.has(element) || !visible(element)) {
              continue
            }
            seen.add(element)
            candidates.push({
              element,
              selector,
              artifactId: element.getAttribute('data-id8-route-card-artifact-id') || null,
              text: normalize(element.innerText || element.getAttribute('aria-label')),
              disabled: Boolean(element.disabled),
            })
          }
        }
        const enabled = candidates.filter((entry) => !entry.disabled)
        const matchingArtifact = expectedArtifactId
          ? enabled.find((entry) => entry.artifactId === expectedArtifactId) ||
            candidates.find((entry) => entry.artifactId === expectedArtifactId)
          : null
        const selected = matchingArtifact || enabled[index] || candidates[index] || enabled[0] || candidates[0]
        if (!selected) {
          return {
            ok: false,
            reason: 'no-route-card',
            expectedArtifactId,
            candidateCount: candidates.length,
          }
        }
        if (expectedArtifactId && selected.artifactId !== expectedArtifactId) {
          return {
            ok: false,
            reason: 'stable-artifact-id-not-found',
            expectedArtifactId,
            selectedArtifactId: selected.artifactId,
            candidateCount: candidates.length,
            candidateArtifactIds: candidates.map((entry) => entry.artifactId).filter(Boolean),
          }
        }
        selected.element.scrollIntoView({ block: 'center', inline: 'center' })
        selected.element.click()
        return {
          ok: true,
          index,
          selector: selected.selector,
          artifactId: selected.artifactId,
          selectedText: selected.text,
          disabled: selected.disabled,
          candidateCount: candidates.length,
          enabledCount: enabled.length,
        }
      })()
    `,
  )
}

async function waitUntil(
  description: string,
  predicate: () => Promise<boolean>,
  timeoutMs = 30000,
): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${description}.`)
}

async function runDryRun(): Promise<void> {
  const artifactDir = join(process.cwd(), 'tmp', 'hosted-step-b-observation', `dry-run-${Date.now()}`)
  const evidence: EvidenceState = {
    artifactDir,
    startedAt: isoNow(),
    completedAt: isoNow(),
    dryRun: true,
    targetUrl: `${canonicalHostedValidationUrl}/start/curate`,
    checkpoints: [
      {
        timestamp: isoNow(),
        action: 'dry_run',
        note: 'Harness syntax and artifact persistence validation only; no hosted page opened.',
      },
    ],
    consoleEvents: [],
    pageErrors: [],
    failedRequests: [],
    networkRequests: [],
    fieldProxyCalls: [],
    stepBSupplyTraces: [],
    providerPatternHits: [],
    routeSourceEvidence: [],
    candidateEvidence: [],
    stepBDiagnosticEvidence: [],
    routeCardsBeforeClick: [],
    selectedRouteCard: null,
    revealedRouteText: null,
    finalError: null,
  }
  await atomicWriteJson(join(artifactDir, 'evidence.json'), evidence)
  const dryRunQueue = createSerializedWriteQueue()
  const dryRunQueuedEvidencePath = join(artifactDir, 'queued-evidence.json')
  await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      dryRunQueue(() =>
        atomicWriteJson(dryRunQueuedEvidencePath, {
          artifactDir,
          dryRun: true,
          queuedWriteIndex: index,
          timestamp: isoNow(),
        }),
      ),
    ),
  )
  await appendNdjson(join(artifactDir, 'events.ndjson'), {
    timestamp: isoNow(),
    kind: 'dry_run',
    message: 'No browser launch, hosted navigation, or provider contact performed.',
  })
  process.stdout.write(`dry-run evidence artifact written: ${artifactDir}\n`)
}

async function runHostedObservation(): Promise<void> {
  const targetUrl = `${getHostedValidationUrl()}/start/curate`
  const artifactDir = join(process.cwd(), 'tmp', 'hosted-step-b-observation', Date.now().toString())
  const evidencePath = join(artifactDir, 'evidence.json')
  const eventPath = join(artifactDir, 'events.ndjson')
  const port = Number(process.env.ID8_OBSERVER_DEBUG_PORT ?? defaultDebugPort)
  const evidence: EvidenceState = {
    artifactDir,
    startedAt: isoNow(),
    completedAt: null,
    dryRun: false,
    targetUrl,
    checkpoints: [],
    consoleEvents: [],
    pageErrors: [],
    failedRequests: [],
    networkRequests: [],
    fieldProxyCalls: [],
    stepBSupplyTraces: [],
    providerPatternHits: [],
    routeSourceEvidence: [],
    candidateEvidence: [],
    stepBDiagnosticEvidence: [],
    routeCardsBeforeClick: [],
    selectedRouteCard: null,
    revealedRouteText: null,
    finalError: null,
  }
  const requestById = new Map<string, NetworkRequestSummary>()
  const pendingWrites: Array<Promise<unknown>> = []
  const queueEvidenceWrite = createSerializedWriteQueue()
  let browser: Awaited<ReturnType<typeof launchChrome>> | null = null
  let targetId: string | null = null
  let cdp: CdpClient | null = null

  async function recordEvent(kind: string, payload: unknown): Promise<void> {
    const event = { timestamp: isoNow(), kind, payload: sanitizeForEvidence(payload) }
    await queueEvidenceWrite(() => appendNdjson(eventPath, event))
  }

  async function persist(reason: string): Promise<void> {
    const snapshot = { ...evidence, persistedAt: isoNow(), persistReason: reason }
    await queueEvidenceWrite(async () => {
      try {
        await atomicWriteJson(evidencePath, snapshot)
      } catch (error: unknown) {
        await appendNdjson(eventPath, {
          timestamp: isoNow(),
          kind: 'persist_error',
          payload: sanitizeForEvidence({
            reason,
            error: error instanceof Error ? error.message : String(error),
          }),
        })
        await durableWriteJson(evidencePath, snapshot)
      }
    })
  }

  async function checkpoint(name: string): Promise<void> {
    const snapshot = cdp ? await collectPageSnapshot(cdp).catch((error: unknown) => ({ snapshotError: String(error) })) : {}
    const entry = {
      timestamp: isoNow(),
      action: name,
      ...sanitizeForEvidence(snapshot),
    } as Record<string, JsonValue>
    evidence.checkpoints.push(entry)
    await recordEvent('checkpoint', entry)
    await persist(`checkpoint:${name}`)
  }

  function scheduleNetworkWrite(promise: Promise<unknown>): void {
    pendingWrites.push(promise.catch((error: unknown) => recordEvent('capture_error', String(error))))
  }

  try {
    browser = await launchChrome(port)
    await waitForDebugger(port)
    const target = await createTarget(port, 'about:blank')
    targetId = target.id
    cdp = createCdpClient(target.webSocketDebuggerUrl)
    await cdp.onOpen
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Network.enable')
    await cdp.send('Log.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1280,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const bypassSecret = readVercelProtectionBypassSecret()
    if (bypassSecret) {
      await cdp.send('Network.setExtraHTTPHeaders', {
        headers: {
          'x-vercel-protection-bypass': bypassSecret,
          'x-vercel-set-bypass-cookie': 'true',
        },
      })
      await recordEvent('bypass_header_configured', { configured: true, value: '<redacted>' })
    }

    cdp.on('Runtime.consoleAPICalled', (params) => {
      const args = Array.isArray(params.args) ? params.args : []
      const texts = args.map((arg) => {
        if (!isRecord(arg)) {
          return String(arg)
        }
        if (typeof arg.value === 'string') {
          return arg.value
        }
        if (typeof arg.description === 'string') {
          return arg.description
        }
        return JSON.stringify(sanitizeForEvidence(arg.preview ?? arg))
      })
      const text = truncate(texts.join(' '))
      const entry = { timestamp: isoNow(), type: String(params.type ?? 'console'), text }
      evidence.consoleEvents.push(entry)
      if (text.includes(stepBSupplyTracePrefix)) {
        const trace = { ...entry, args: sanitizeForEvidence(args) }
        evidence.stepBSupplyTraces.push(trace)
        scheduleNetworkWrite(recordEvent('step_b_supply_trace', trace))
      }
      for (const pattern of scanProviderPatterns(text)) {
        const hit = { timestamp: isoNow(), source: 'console', pattern, text }
        evidence.providerPatternHits.push(hit)
        scheduleNetworkWrite(recordEvent('provider_pattern_hit', hit))
      }
      scheduleNetworkWrite(recordEvent('console', entry))
    })

    cdp.on('Runtime.exceptionThrown', (params) => {
      const entry = { timestamp: isoNow(), exception: sanitizeForEvidence(params.exceptionDetails ?? params) }
      evidence.pageErrors.push(entry)
      scheduleNetworkWrite(recordEvent('page_error', entry))
    })

    cdp.on('Log.entryAdded', (params) => {
      const entry = sanitizeForEvidence(params.entry ?? params)
      scheduleNetworkWrite(recordEvent('browser_log', entry))
    })

    cdp.on('Network.requestWillBeSent', (params) => {
      const requestId = String(params.requestId)
      const request = isRecord(params.request) ? params.request : {}
      const url = String(request.url ?? '')
      const summary: NetworkRequestSummary = {
        requestId,
        url,
        method: String(request.method ?? 'GET'),
        path: safeUrlPath(url),
        isFieldProxy: safeUrlPath(url) === fieldProxyPath,
        queryLabel: extractQueryLabel(request.postData),
        status: null,
        type: typeof params.type === 'string' ? params.type : null,
        failed: false,
        failureReason: null,
      }
      requestById.set(requestId, summary)
      evidence.networkRequests.push(summary)
      for (const pattern of scanProviderPatterns(url)) {
        const hit = { timestamp: isoNow(), source: 'network-url', pattern, url }
        evidence.providerPatternHits.push(hit)
        scheduleNetworkWrite(recordEvent('provider_pattern_hit', hit))
      }
      scheduleNetworkWrite(recordEvent('network_request', summary))
    })

    cdp.on('Network.responseReceived', (params) => {
      const requestId = String(params.requestId)
      const response = isRecord(params.response) ? params.response : {}
      const summary = requestById.get(requestId)
      if (summary) {
        summary.status = typeof response.status === 'number' ? response.status : null
        scheduleNetworkWrite(recordEvent('network_response', summary))
      }
    })

    cdp.on('Network.loadingFailed', (params) => {
      const requestId = String(params.requestId)
      const summary = requestById.get(requestId)
      if (summary) {
        summary.failed = true
        summary.failureReason = String(params.errorText ?? 'unknown')
        evidence.failedRequests.push({ ...summary })
        scheduleNetworkWrite(recordEvent('network_failed', summary))
      }
    })

    cdp.on('Network.loadingFinished', (params) => {
      const requestId = String(params.requestId)
      const summary = requestById.get(requestId)
      if (!summary?.isFieldProxy || !cdp) {
        return
      }
      scheduleNetworkWrite(
        cdp
          .send<{ body?: string }>('Network.getResponseBody', { requestId })
          .then(async (bodyResult) => {
            const fieldSummary: FieldProxyCallSummary = {
              ...summary,
              ...summarizeFieldProxyBody(bodyResult.body ?? ''),
            }
            evidence.fieldProxyCalls.push(fieldSummary)
            const candidateEvidence = {
              timestamp: isoNow(),
              queryLabel: fieldSummary.queryLabel,
              candidateSummaries: fieldSummary.candidateSummaries,
            }
            evidence.candidateEvidence.push(candidateEvidence)
            await recordEvent('field_proxy_response_summary', fieldSummary)
            await recordEvent('candidate_evidence_summary', candidateEvidence)
            await persist('field_proxy_response_summary')
          }),
      )
    })

    await checkpoint('before_open_start_curate')
    await cdp.send('Page.navigate', { url: targetUrl })
    await waitUntil('page body after opening /start/curate', async () => {
      if (!cdp) {
        return false
      }
      const snapshot = await collectPageSnapshot(cdp)
      return typeof snapshot.bodyText === 'string' && snapshot.bodyText.length > 0
    })
    await checkpoint('after_open_start_curate')

    await checkpoint('before_select_coffee_books')
    const starterResult = await selectCoffeeBooksStarter(cdp)
    await recordEvent('action_result', { action: 'select_coffee_books', result: starterResult })
    if (!starterResult.ok) {
      throw new Error('Could not select Coffee & Books starter.')
    }
    await checkpoint('after_select_coffee_books')

    await checkpoint('before_click_continue')
    const continueResult = await clickTextButton(cdp, 'Continue')
    await recordEvent('action_result', { action: 'click_continue', result: continueResult })
    if (!continueResult.ok) {
      throw new Error('Could not click Continue.')
    }
    await checkpoint('after_click_continue')
    const routeSourceAfterContinue = await readRouteSourceEvidence(cdp)
    evidence.routeSourceEvidence.push({
      timestamp: isoNow(),
      action: 'after_click_continue',
      ...routeSourceAfterContinue,
    })
    await recordEvent('route_source_evidence', evidence.routeSourceEvidence[evidence.routeSourceEvidence.length - 1])
    const diagnosticsAfterContinue = await readStepBCoffeeBooksDiagnostics(cdp)
    evidence.stepBDiagnosticEvidence.push({
      timestamp: isoNow(),
      action: 'after_click_continue',
      ...diagnosticsAfterContinue,
    })
    await recordEvent(
      'step_b_coffee_books_diagnostics',
      evidence.stepBDiagnosticEvidence[evidence.stepBDiagnosticEvidence.length - 1],
    )
    await persist('route_source_after_continue')

    await waitUntil('visible route cards or no-card diagnostics after candidate supply', async () => {
      if (!cdp) {
        return false
      }
      const cards = await readRouteCards(cdp)
      evidence.routeCardsBeforeClick = cards
      await recordEvent('route_card_poll', { count: cards.length, cards })
      await persist('route_card_poll')
      if (cards.length > 0) {
        return true
      }
      const fieldProxyCompletedCount = evidence.networkRequests.filter(
        (request) => request.isFieldProxy && request.status != null,
      ).length
      if (fieldProxyCompletedCount < 3) {
        return false
      }
      const noCardDiagnostics = await readStepBCoffeeBooksDiagnostics(cdp)
      evidence.stepBDiagnosticEvidence.push({
        timestamp: isoNow(),
        action: 'after_candidate_supply_no_card_poll',
        ...noCardDiagnostics,
      })
      await recordEvent(
        'step_b_coffee_books_diagnostics',
        evidence.stepBDiagnosticEvidence[evidence.stepBDiagnosticEvidence.length - 1],
      )
      await persist('no_card_diagnostics_after_candidate_supply')
      return true
    })
    await checkpoint('before_click_route_card')
    evidence.routeCardsBeforeClick = await readRouteCards(cdp)
    await recordEvent('route_cards_before_click', evidence.routeCardsBeforeClick)
    await persist('route_cards_before_click')

    const selectedCard = evidence.routeCardsBeforeClick[0]
    if (!selectedCard) {
      const noCardDiagnostics = await readStepBCoffeeBooksDiagnostics(cdp)
      evidence.stepBDiagnosticEvidence.push({
        timestamp: isoNow(),
        action: 'no_visible_route_card_after_candidate_supply',
        ...noCardDiagnostics,
      })
      await recordEvent(
        'step_b_coffee_books_diagnostics',
        evidence.stepBDiagnosticEvidence[evidence.stepBDiagnosticEvidence.length - 1],
      )
      const routeSourceNoCard = await readRouteSourceEvidence(cdp)
      evidence.routeSourceEvidence.push({
        timestamp: isoNow(),
        action: 'no_visible_route_card_after_candidate_supply',
        ...routeSourceNoCard,
      })
      await recordEvent(
        'route_source_evidence',
        evidence.routeSourceEvidence[evidence.routeSourceEvidence.length - 1],
      )
      await persist('no_visible_route_card_after_candidate_supply')
      if (!noCardDiagnostics.present) {
        throw new Error(
          'No visible route card found and Step B Coffee & Books diagnostics were missing after candidate supply.',
        )
      }
      return
    }
    const selectedCardArtifactId =
      typeof selectedCard.artifactId === 'string' ? selectedCard.artifactId : null
    if (selectedCardArtifactId) {
      await waitUntil('stable route card artifact id before click', async () => {
        if (!cdp) {
          return false
        }
        const cards = await readRouteCards(cdp)
        const matchingCard = cards.find((card) => card.artifactId === selectedCardArtifactId)
        await recordEvent('route_card_stable_artifact_poll', {
          expectedArtifactId: selectedCardArtifactId,
          count: cards.length,
          found: Boolean(matchingCard),
          cards,
        })
        return Boolean(matchingCard)
      }, 3_000)
    }
    const cardClickResult = await clickRouteCard(cdp, 0, selectedCardArtifactId)
    evidence.selectedRouteCard = {
      selectorUsed: String(cardClickResult.selector ?? selectedCard.selector ?? 'unknown'),
      artifactId: String(cardClickResult.artifactId ?? selectedCardArtifactId ?? ''),
      selectedText: String(cardClickResult.selectedText ?? selectedCard.text ?? ''),
      clickResult: sanitizeForEvidence(cardClickResult),
    }
    await recordEvent('selected_route_card', evidence.selectedRouteCard)
    if (!cardClickResult.ok) {
      throw new Error('Could not click first visible route card.')
    }
    await checkpoint('after_click_route_card')
    const routeSourceAfterCardClick = await readRouteSourceEvidence(cdp)
    evidence.routeSourceEvidence.push({
      timestamp: isoNow(),
      action: 'after_click_route_card',
      ...routeSourceAfterCardClick,
    })
    await recordEvent('route_source_evidence', evidence.routeSourceEvidence[evidence.routeSourceEvidence.length - 1])
    const diagnosticsAfterCardClick = await readStepBCoffeeBooksDiagnostics(cdp)
    evidence.stepBDiagnosticEvidence.push({
      timestamp: isoNow(),
      action: 'after_click_route_card',
      ...diagnosticsAfterCardClick,
    })
    await recordEvent(
      'step_b_coffee_books_diagnostics',
      evidence.stepBDiagnosticEvidence[evidence.stepBDiagnosticEvidence.length - 1],
    )
    await persist('route_source_after_card_click')

    await checkpoint('before_click_review_this_route')
    const reviewResult = await clickTextButton(cdp, 'Review this route')
    await recordEvent('action_result', { action: 'click_review_this_route', result: reviewResult })
    if (!reviewResult.ok) {
      throw new Error('Could not click Review this route.')
    }
    await new Promise((resolve) => setTimeout(resolve, 3500))
    await checkpoint('after_click_review_this_route')
    const finalSnapshot = await collectPageSnapshot(cdp)
    evidence.revealedRouteText =
      typeof finalSnapshot.bodyText === 'string' ? truncate(finalSnapshot.bodyText, 8000) : null
  } catch (error: unknown) {
    evidence.finalError = error instanceof Error ? error.stack ?? error.message : String(error)
    await recordEvent('fatal_error', evidence.finalError)
    process.exitCode = 1
  } finally {
    await Promise.allSettled(pendingWrites)
    if (cdp) {
      const finalDiagnostics = await readStepBCoffeeBooksDiagnostics(cdp).catch((error: unknown) => ({
        present: false,
        diagnostic: null,
        readError: error instanceof Error ? error.message : String(error),
      }))
      evidence.stepBDiagnosticEvidence.push({
        timestamp: isoNow(),
        action: 'finally_dump',
        ...finalDiagnostics,
      })
      await recordEvent(
        'step_b_coffee_books_diagnostics',
        evidence.stepBDiagnosticEvidence[evidence.stepBDiagnosticEvidence.length - 1],
      ).catch(() => undefined)
      await checkpoint('finally_dump').catch((error: unknown) =>
        recordEvent('finally_checkpoint_error', String(error)),
      )
      await cdp.close().catch(() => undefined)
    }
    if (targetId) {
      await closeTarget(port, targetId)
    }
    if (browser) {
      browser.process.kill()
    }
    evidence.completedAt = isoNow()
    await persist('finally')
    process.stdout.write(`hosted Step B observation evidence written: ${artifactDir}\n`)
  }
}

async function main(): Promise<void> {
  if (process.argv.includes('--dry-run')) {
    await runDryRun()
    return
  }
  if (process.argv.includes('--help')) {
    process.stdout.write(
      [
        'Usage:',
        '  npx tsx scripts/observe-hosted-step-b-supply.ts --dry-run',
        '  ID8_HOSTED_VALIDATION_URL=<canonical preview> npx tsx scripts/observe-hosted-step-b-supply.ts',
        '',
        'The hosted mode opens /start/curate once and persists evidence incrementally under tmp/hosted-step-b-observation/.',
      ].join('\n'),
    )
    process.stdout.write('\n')
    return
  }
  await runHostedObservation()
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
