import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const AUTHORITATIVE_STAGE0_EVIDENCE_SHA256 =
  '9fa6fafbc1fdaf11859bcce709722417760c25f290ed1e84897993f14525f65f'
export const AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT = 96

export interface IdentityEvidenceCorpusSnapshot {
  venues: unknown[]
}

export interface IdentityEvidenceCorpusValidation<TCorpus extends IdentityEvidenceCorpusSnapshot> {
  canonicalSha256: string
  corpus: TCorpus
  rowCount: number
}

export function canonicalizeEvidenceLineEndings(bytes: Uint8Array): Buffer {
  const canonical: number[] = []
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index]
    if (byte === 13) {
      if (bytes[index + 1] === 10) {
        index += 1
      }
      canonical.push(10)
      continue
    }
    canonical.push(byte)
  }
  return Buffer.from(canonical)
}

export function hashCanonicalEvidenceBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(canonicalizeEvidenceLineEndings(bytes)).digest('hex')
}

export function validateIdentityEvidenceCorpusBytes<TCorpus extends IdentityEvidenceCorpusSnapshot>(
  bytes: Uint8Array,
  params: {
    expectedRowCount: number
    expectedSha256: string
    label: string
  },
): IdentityEvidenceCorpusValidation<TCorpus> {
  const canonicalSha256 = hashCanonicalEvidenceBytes(bytes)
  if (canonicalSha256 !== params.expectedSha256) {
    throw new Error(`${params.label} canonical corpus hash changed: ${canonicalSha256}`)
  }

  const corpus = JSON.parse(Buffer.from(bytes).toString('utf8')) as TCorpus
  const rowCount = Array.isArray(corpus.venues) ? corpus.venues.length : -1
  if (rowCount !== params.expectedRowCount) {
    throw new Error(`${params.label} expected ${params.expectedRowCount} corpus observations, got ${rowCount}`)
  }

  return {
    canonicalSha256,
    corpus,
    rowCount,
  }
}

export function validateIdentityEvidenceCorpusFile<TCorpus extends IdentityEvidenceCorpusSnapshot>(
  path: string,
  params: {
    expectedRowCount?: number
    expectedSha256?: string
    label?: string
  } = {},
): IdentityEvidenceCorpusValidation<TCorpus> {
  return validateIdentityEvidenceCorpusBytes<TCorpus>(readFileSync(path), {
    expectedRowCount: params.expectedRowCount ?? AUTHORITATIVE_STAGE0_EVIDENCE_ROW_COUNT,
    expectedSha256: params.expectedSha256 ?? AUTHORITATIVE_STAGE0_EVIDENCE_SHA256,
    label: params.label ?? path,
  })
}
