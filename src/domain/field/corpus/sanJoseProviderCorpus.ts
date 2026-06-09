import generatedCorpus from './sanJoseProviderCorpus.generated.json'
import { validatePromotedFieldProviderCorpus } from './promoteProviderCorpus'
import type { PromotedFieldProviderCorpus } from './types'

export const sanJoseProviderCorpus = generatedCorpus as PromotedFieldProviderCorpus

const validation = validatePromotedFieldProviderCorpus(sanJoseProviderCorpus)

if (!validation.valid) {
  throw new Error(`San Jose provider corpus failed validation: ${validation.errors.join('; ')}`)
}

export const sanJoseProviderCorpusVenues = sanJoseProviderCorpus.venues
