export type RefinementMode =
  | 'more-exciting'
  | 'more-relaxed'
  | 'closer-by'
  | 'more-unique'
  | 'little-fancier'

export type RefinementOption = {
  mode: RefinementMode
  label: string
  description: string
}

export const refinementOptions: RefinementOption[] = [
  {
    mode: 'more-exciting',
    label: 'More Exciting',
    description: 'Leans into stronger highlights and livelier surprises.',
  },
  {
    mode: 'more-relaxed',
    label: 'More Relaxed',
    description: 'Softens pacing with calmer transitions and endings.',
  },
  {
    mode: 'closer-by',
    label: 'Closer By',
    description: 'Tightens geography and favors shorter movement.',
  },
  {
    mode: 'more-unique',
    label: 'More Unique',
    description: 'Pushes distinct, underexposed options.',
  },
  {
    mode: 'little-fancier',
    label: 'A Little Fancier',
    description: 'Adds modest polish and elevated choices.',
  },
]
