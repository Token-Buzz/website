'use client'

import { useState, forwardRef } from 'react'
import { EyeIcon } from './icons'

interface TextFieldProps {
  label: string
  badge?: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
  error?: string
  onTogglePassword?: () => void
  passwordVisible?: boolean
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  disabled?: boolean
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, badge, type = 'text', value, onChange, placeholder, autoFocus, error, onTogglePassword, passwordVisible, autoComplete, inputMode, disabled },
  ref
) {
  const [focused, setFocused] = useState(false)
  const hasEye = !!onTogglePassword

  return (
    <div className="tb-field">
      <div className="tb-field-head">
        <label className="tb-field-label">{label}</label>
        {badge && <span className="tb-field-badge">{badge}</span>}
      </div>
      <div className={`tb-input-wrap${focused ? ' is-focused' : ''}${error ? ' is-error' : ''}`}>
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="tb-input"
          autoComplete={autoComplete ?? (type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off')}
          inputMode={inputMode}
          spellCheck={false}
          disabled={disabled}
        />
        {hasEye && (
          <button
            type="button"
            className="tb-eye"
            onClick={onTogglePassword}
            tabIndex={-1}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
          >
            <EyeIcon off={passwordVisible} />
          </button>
        )}
      </div>
      {error && <div className="tb-field-error">{error}</div>}
    </div>
  )
})
