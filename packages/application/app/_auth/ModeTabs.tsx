import Link from 'next/link'

interface ModeTabsProps {
  mode: 'in' | 'up'
}

export function ModeTabs({ mode }: ModeTabsProps) {
  return (
    <div className="tb-tabs" role="tablist">
      <Link
        href="/sign-in"
        role="tab"
        aria-selected={mode === 'in'}
        className={`tb-tab${mode === 'in' ? ' is-active' : ''}`}
      >
        Sign in
      </Link>
      <Link
        href="/sign-up"
        role="tab"
        aria-selected={mode === 'up'}
        className={`tb-tab${mode === 'up' ? ' is-active' : ''}`}
      >
        Sign up
      </Link>
      <span
        className="tb-tab-indicator"
        style={{ transform: `translateX(${mode === 'in' ? 0 : 100}%)` }}
      />
    </div>
  )
}
