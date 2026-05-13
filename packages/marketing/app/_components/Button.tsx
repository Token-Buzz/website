import React from 'react'
import Icon, { type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'inverse' | 'link'
export type ButtonSize    = 'md' | 'lg'

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary:   { background: 'var(--buzz-500)', color: '#fff' },
  secondary: { background: 'var(--inv-bg)', color: 'var(--inv-fg)' },
  ghost:     { background: 'transparent', color: 'var(--fg-1)', borderColor: 'var(--border-strong)' },
  inverse:   { background: 'var(--bg)', color: 'var(--fg-1)' },
  link:      { background: 'transparent', color: 'var(--fg-1)', padding: 0, border: 'none' },
}

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
  href?: string
  onClick?: React.MouseEventHandler
  style?: React.CSSProperties
  children?: React.ReactNode
  className?: string
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  href,
  onClick,
  style,
  children,
  className,
}: ButtonProps) {
  const base: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    border: '1px solid transparent',
    borderRadius: size === 'lg' ? 8 : 6,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 160ms cubic-bezier(0.2, 0.7, 0.2, 1)',
    letterSpacing: '-0.005em',
    lineHeight: 1,
    fontSize: size === 'lg' ? 16 : 14,
    padding: size === 'lg' ? '14px 22px' : '10px 16px',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  const iconSize = size === 'lg' ? 16 : 14

  const combined: React.CSSProperties = { ...base, ...VARIANT_STYLES[variant], ...style }

  if (href) {
    return (
      <a href={href} style={combined} className={className}>
        {icon      && <Icon name={icon} size={iconSize} />}
        {children}
        {iconRight && <Icon name={iconRight} size={iconSize} />}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} style={combined} className={className}>
      {icon      && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  )
}
