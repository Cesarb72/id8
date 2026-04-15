import { useMemo, useState } from 'react'
import { refinementOptions } from '../../domain/types/refinement'
import type { RefinementMode } from '../../domain/types/refinement'

interface RefineSheetProps {
  initialModes: RefinementMode[]
  onApply: (modes: RefinementMode[]) => void
  onClose: () => void
}

export function RefineSheet({ initialModes, onApply, onClose }: RefineSheetProps) {
  const [selectedModes, setSelectedModes] = useState<RefinementMode[]>(initialModes)
  const selectedSet = useMemo(() => new Set(selectedModes), [selectedModes])

  const toggleMode = (mode: RefinementMode) => {
    setSelectedModes((current) =>
      current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode],
    )
  }

  return (
    <section className="refine-sheet">
      <header className="refine-sheet-header">
        <h3>Refine This Plan</h3>
        <button type="button" className="ghost-button" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="refine-options">
        {refinementOptions.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={`refine-option${selectedSet.has(option.mode) ? ' selected' : ''}`}
            onClick={() => toggleMode(option.mode)}
          >
            <span>{option.label}</span>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
      <footer className="refine-sheet-footer">
        <button type="button" className="primary-button" onClick={() => onApply(selectedModes)}>
          Apply Refinement
        </button>
      </footer>
    </section>
  )
}
