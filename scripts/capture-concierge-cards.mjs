import fs from 'node:fs/promises'
import path from 'node:path'

const DEBUG_PORT = 9222
const APP_URL = 'http://127.0.0.1:4173/dev/concierge'

const scenarios = [
  {
    slug: 'san-jose-romantic-lively',
    city: 'San Jose',
    persona: 'romantic',
    vibe: 'lively',
  },
  {
    slug: 'denver-friends-cozy',
    city: 'Denver',
    persona: 'friends',
    vibe: 'cozy',
  },
  {
    slug: 'austin-family-cultured',
    city: 'Austin, TX',
    persona: 'family',
    vibe: 'cultured',
  },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return response.json()
}

async function createTarget(url) {
  const endpoint = `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(url)}`
  return fetchJson(endpoint, { method: 'PUT' })
}

async function closeTarget(targetId) {
  const endpoint = `http://127.0.0.1:${DEBUG_PORT}/json/close/${targetId}`
  await fetch(endpoint).catch(() => undefined)
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl)
  let nextId = 1
  const pending = new Map()
  const events = new Map()

  const onOpen = new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve())
    socket.addEventListener('error', (event) => {
      reject(new Error(`WebSocket error: ${event.type}`))
    })
  })

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (typeof message.id === 'number') {
      const entry = pending.get(message.id)
      if (!entry) {
        return
      }
      pending.delete(message.id)
      if (message.error) {
        entry.reject(new Error(message.error.message))
      } else {
        entry.resolve(message.result ?? {})
      }
      return
    }

    if (message.method) {
      const listeners = events.get(message.method)
      if (!listeners) {
        return
      }
      for (const listener of listeners) {
        listener(message.params ?? {})
      }
    }
  })

  async function send(method, params = {}) {
    await onOpen
    const id = nextId++
    const payload = { id, method, params }
    const promise = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
    })
    socket.send(JSON.stringify(payload))
    return promise
  }

  function on(method, listener) {
    const listeners = events.get(method) ?? []
    listeners.push(listener)
    events.set(method, listeners)
    return () => {
      const next = (events.get(method) ?? []).filter((entry) => entry !== listener)
      if (next.length === 0) {
        events.delete(method)
      } else {
        events.set(method, next)
      }
    }
  }

  async function close() {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }

  return { send, on, close, onOpen }
}

async function waitForLoad(cdp, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off()
      reject(new Error('Timed out waiting for Page.loadEventFired'))
    }, timeoutMs)
    const off = cdp.on('Page.loadEventFired', () => {
      clearTimeout(timer)
      off()
      resolve()
    })
  })
}

async function applyScenario(cdp, scenario) {
  const expression = `
    (() => {
      const cityInput = document.querySelector('.preview-adjustments-grid.compact input')
      const selects = Array.from(document.querySelectorAll('.preview-adjustments-grid.compact select'))
      const personaSelect = selects[0]
      const vibeSelect = selects[1]

      if (!cityInput || !personaSelect || !vibeSelect) {
        return { ok: false, reason: 'Missing controls' }
      }

      const dispatchText = (element, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        descriptor?.set?.call(element, value)
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }

      const dispatchSelect = (element, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
        descriptor?.set?.call(element, value)
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }

      dispatchText(cityInput, ${JSON.stringify(scenario.city)})
      dispatchSelect(personaSelect, ${JSON.stringify(scenario.persona)})
      dispatchSelect(vibeSelect, ${JSON.stringify(scenario.vibe)})

      return {
        ok: true,
        city: cityInput.value,
        persona: personaSelect.value,
        vibe: vibeSelect.value,
      }
    })();
  `
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  return result.result?.value
}

async function readCardText(cdp) {
  const expression = `
    (() => {
      const cards = Array.from(document.querySelectorAll('.reality-step-card')).slice(0, 3)
      return cards.map((card) => card.innerText.replace(/\\s+/g, ' ').trim())
    })();
  `
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  return result.result?.value ?? []
}

async function captureScenario(cdp, outPath, scenario) {
  await cdp.send('Page.navigate', { url: APP_URL })
  await waitForLoad(cdp)
  await sleep(500)

  const applyResult = await applyScenario(cdp, scenario)
  if (!applyResult?.ok) {
    throw new Error(`Could not apply scenario: ${applyResult?.reason ?? 'unknown'}`)
  }

  await sleep(2200)
  const cardText = await readCardText(cdp)
  if (cardText.length === 0) {
    throw new Error(`No cards found for ${scenario.slug}`)
  }

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    fromSurface: true,
  })
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, Buffer.from(screenshot.data, 'base64'))
}

async function main() {
  const phase = process.argv[2]
  if (!phase) {
    throw new Error('Usage: node scripts/capture-concierge-cards.mjs <before|after>')
  }

  const target = await createTarget(APP_URL)
  const cdp = createCdpClient(target.webSocketDebuggerUrl)
  await cdp.onOpen

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1280,
    deviceScaleFactor: 1,
    mobile: false,
  })

  try {
    for (const scenario of scenarios) {
      const output = path.join(
        process.cwd(),
        'tmp',
        'screenshots',
        phase,
        `${scenario.slug}.png`,
      )
      await captureScenario(cdp, output, scenario)
      console.log(`Saved ${output}`)
    }
  } finally {
    await cdp.close()
    await closeTarget(target.id)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
