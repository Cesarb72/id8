interface ProgressDotsProps {
  total: number
  current: number
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="progress-dots" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, index) => index + 1).map((value) => (
        <span
          key={value}
          className={`progress-dot${value <= current ? ' active' : ''}`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
