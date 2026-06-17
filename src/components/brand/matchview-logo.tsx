import { cn } from '@/shared/ui/cn'

interface MatchViewLogoProps {
  variant?: 'full' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeConfig = {
  sm: { icon: 'w-5 h-5', text: 'text-base', gap: 'gap-1.5' },
  md: { icon: 'w-7 h-7', text: 'text-xl', gap: 'gap-2' },
  lg: { icon: 'w-10 h-10', text: 'text-3xl', gap: 'gap-3' },
}

function MarkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="40 -2 120 120" className={className}>
      <polygon points="100,4 156,44 134,112 66,112 44,44" fill="#1845C8" />
      <circle cx="100" cy="62" r="28" fill="white" opacity="0.15" />
      <circle cx="100" cy="62" r="28" fill="none" stroke="white" strokeWidth="2" opacity="0.6" />
      <polygon points="93,50 93,74 115,62" fill="white" />
    </svg>
  )
}

export function MatchViewLogo({ variant = 'full', size = 'md', className }: MatchViewLogoProps) {
  const config = sizeConfig[size]

  if (variant === 'icon') {
    return <MarkIcon className={cn(config.icon, className)} />
  }

  return (
    <div className={cn('flex items-center', config.gap, className)}>
      <MarkIcon className={config.icon} />
      <span className={cn(config.text, 'font-semibold tracking-tight text-foreground')}>
        MatchView
      </span>
    </div>
  )
}
