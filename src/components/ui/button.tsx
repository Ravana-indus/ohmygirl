export function Button({ children, onClick, variant = 'default', disabled, className = '' }: { children: React.ReactNode; onClick?: () => void; variant?: 'default' | 'outline' | 'ghost'; disabled?: boolean; className?: string }) {
  const base = 'px-3 py-2 rounded-md text-sm'
  const styles = variant === 'outline' ? 'border' : variant === 'ghost' ? '' : 'bg-black text-white'
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>{children}</button>
  )
}

