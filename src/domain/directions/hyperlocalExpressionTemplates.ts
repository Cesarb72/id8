const REPLACE_EVENT_PATTERN = /\bevents?\b/gi

export type ExpressionFamily =
  | 'social'
  | 'cultural'
  | 'playful'
  | 'intimate'
  | 'exploratory'
  | 'ambient'
  | 'eventful'
  | 'ritual'
  | 'indulgent'

export type ExpressionFamilyMode = ExpressionFamily | 'neutral'

export const FAMILY_EXPRESSION_CONFIDENCE_MIN = 0.58

export const HYPERLOCAL_REASON_TEMPLATES: Record<string, string> = {
  high_activation_core: 'Dense overlap keeps transitions quick.',
  steady_activation_base: 'Steady overlap supports an easy route shape.',
  identity_forward_mix: 'The category mix reads signature, not generic.',
  identity_coherent_mix: 'Category and lane mix stay coherent across stops.',
  strong_environmental_influence: 'Nearby support strongly shapes the experience.',
  tight_walkable_micro_pocket: 'Compact layout keeps movement focused.',
  baseline_micro_pocket: 'Balanced structure keeps pacing predictable.',
  low_specificity_fallback: 'Signals stay broad, so this remains area-level.',
}

export const HYPERLOCAL_REASON_TITLE_SIGNALS: Record<string, string> = {
  high_activation_core: 'High Overlap',
  steady_activation_base: 'Steady Overlap',
  identity_forward_mix: 'Signature Mix',
  identity_coherent_mix: 'Coherent Mix',
  strong_environmental_influence: 'Strong Support',
  tight_walkable_micro_pocket: 'Tight Layout',
  baseline_micro_pocket: 'Balanced Mix',
  low_specificity_fallback: 'Balanced Area',
}

const FAMILY_SUBTITLE_TEMPLATES: Record<ExpressionFamily, string> = {
  social: 'Dense overlap keeps social momentum moving.',
  cultural: 'Structured layout keeps pacing intentional and focused.',
  playful: 'Mixed-use layout leaves room for activity-forward detours.',
  intimate: 'Contained layout keeps movement calm and close.',
  exploratory: 'Layered mix supports varied progression across the area.',
  ambient: 'Calmer structure unfolds slowly and settles into the area.',
  eventful: 'Energy peaks in bursts with punctuated moments between stops.',
  ritual: 'The route progresses cleanly and moves in sequence.',
  indulgent: 'Pacing slows so you can settle in around an anchored experience.',
}

const FAMILY_SUPPORT_EMPHASIS: Record<ExpressionFamily, string> = {
  social: 'Supports quick handoffs between high-overlap stops.',
  cultural: 'Supports focused transitions across culture-forward anchors.',
  playful: 'Supports switch-ups without long reset gaps.',
  intimate: 'Supports quieter transitions with lower-friction pacing.',
  exploratory: 'Supports discovery across mixed adjacent signals.',
  ambient: 'Supports slower movement that lingers as the area settles into pace.',
  eventful: 'Supports punctuated bursts while preserving route continuity.',
  ritual: 'Supports a step-into flow that progresses cleanly.',
  indulgent: 'Supports settle-in pacing centered around richer anchors.',
}

const FAMILY_BULLET_ORDER: Record<ExpressionFamily, string[]> = {
  social: ['transition', 'density', 'mix', 'contrast'],
  cultural: ['transition', 'mix', 'contrast', 'density'],
  playful: ['contrast', 'mix', 'transition', 'density'],
  intimate: ['density', 'transition', 'mix', 'contrast'],
  exploratory: ['mix', 'contrast', 'transition', 'density'],
  ambient: ['density', 'transition', 'mix', 'contrast'],
  eventful: ['transition', 'contrast', 'density', 'mix'],
  ritual: ['transition', 'mix', 'density', 'contrast'],
  indulgent: ['mix', 'density', 'transition', 'contrast'],
}

const FAMILY_ANCHOR_ORDER: Record<
  ExpressionFamily,
  Array<'Anchored by' | 'Centered around' | 'Built around'>
> = {
  social: ['Built around', 'Centered around', 'Anchored by'],
  cultural: ['Anchored by', 'Centered around', 'Built around'],
  playful: ['Built around', 'Centered around', 'Anchored by'],
  intimate: ['Centered around', 'Anchored by', 'Built around'],
  exploratory: ['Centered around', 'Built around', 'Anchored by'],
  ambient: ['Centered around', 'Built around', 'Anchored by'],
  eventful: ['Built around', 'Anchored by', 'Centered around'],
  ritual: ['Anchored by', 'Centered around', 'Built around'],
  indulgent: ['Anchored by', 'Built around', 'Centered around'],
}

export function normalizeToken(value: string): string {
  const cleaned = value
    .replace(REPLACE_EVENT_PATTERN, 'activity')
    .replace(/[_-]+/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : 'mixed use'
}

export function toDisplayToken(value: string): string {
  return normalizeToken(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function toKey(value: string): string {
  return normalizeToken(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function clampWords(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) {
    return words.join(' ')
  }
  return words.slice(0, maxWords).join(' ')
}

export function formatList(values: string[]): string {
  if (values.length === 0) {
    return 'Mixed Use'
  }
  if (values.length === 1) {
    return toDisplayToken(values[0])
  }
  return `${toDisplayToken(values[0])} + ${toDisplayToken(values[1])}`
}

export function resolveReasonTemplate(reasonKey: string): string {
  return (
    HYPERLOCAL_REASON_TEMPLATES[reasonKey] ??
    `Signal remains ${normalizeToken(reasonKey)}.`
  )
}

export function resolveReasonTitleSignal(reasonKey: string): string {
  return HYPERLOCAL_REASON_TITLE_SIGNALS[reasonKey] ?? 'Balanced Mix'
}

function isExpressionFamily(value: string): value is ExpressionFamily {
  return (
    value === 'social' ||
    value === 'cultural' ||
    value === 'playful' ||
    value === 'intimate' ||
    value === 'exploratory' ||
    value === 'ambient' ||
    value === 'eventful' ||
    value === 'ritual' ||
    value === 'indulgent'
  )
}

export function getExpressionFamilyMode(
  family?: string,
  confidence?: number,
): ExpressionFamilyMode {
  if (!family || !isExpressionFamily(family)) {
    return 'neutral'
  }
  if ((confidence ?? 0) < FAMILY_EXPRESSION_CONFIDENCE_MIN) {
    return 'neutral'
  }
  return family
}

export function getFamilySubtitleTemplate(mode: ExpressionFamilyMode): string | undefined {
  if (mode === 'neutral') {
    return undefined
  }
  return FAMILY_SUBTITLE_TEMPLATES[mode]
}

export function getFamilySupportEmphasis(mode: ExpressionFamilyMode): string | undefined {
  if (mode === 'neutral') {
    return undefined
  }
  return FAMILY_SUPPORT_EMPHASIS[mode]
}

export function getFamilyBulletOrder(mode: ExpressionFamilyMode): string[] {
  if (mode === 'neutral') {
    return ['density', 'mix', 'transition', 'contrast']
  }
  return FAMILY_BULLET_ORDER[mode]
}

export function getFamilyAnchorOrder(
  mode: ExpressionFamilyMode,
): Array<'Anchored by' | 'Centered around' | 'Built around'> {
  if (mode === 'neutral') {
    return ['Anchored by', 'Centered around', 'Built around']
  }
  return FAMILY_ANCHOR_ORDER[mode]
}

export function getFamilyTemplateKeys(mode: ExpressionFamilyMode): string[] {
  if (mode === 'neutral') {
    return []
  }
  return [
    `family_mode_${mode}`,
    `family_subtitle_${mode}`,
    `family_support_${mode}`,
    `family_bullets_${mode}`,
  ]
}
