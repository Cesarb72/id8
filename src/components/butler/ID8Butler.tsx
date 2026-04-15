interface ID8ButlerProps {
  message: string
}

export function ID8Butler({ message }: ID8ButlerProps) {
  return (
    <aside className="id8-butler">
      <p className="id8-butler-label">ID.8 Concierge</p>
      <p className="id8-butler-message">{message}</p>
    </aside>
  )
}
