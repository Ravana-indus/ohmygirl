export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  return <div className={`${dim} inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
}

