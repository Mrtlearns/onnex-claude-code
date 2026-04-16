import { ReactNode, ButtonHTMLAttributes } from 'react'

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles = {
  default: 'bg-white/10 hover:bg-white/20 border-white/20 text-white',
  primary: 'bg-blue-500/70 hover:bg-blue-500/90 border-blue-400/40 text-white hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]',
  danger: 'bg-red-500/70 hover:bg-red-500/90 border-red-400/40 text-white',
  ghost: 'bg-transparent hover:bg-white/10 border-transparent text-white/70 hover:text-white',
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
}

export default function GlassButton({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: GlassButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center gap-2 font-medium rounded-lg border
        backdrop-filter backdrop-blur-sm transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
