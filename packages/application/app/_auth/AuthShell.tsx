import './auth.css'
import { Wordmark } from './Wordmark'
import { LockIcon } from './icons'

interface AuthShellProps {
  children: React.ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="tb-stage">
      <section className="tb-pane">
        <div className="tb-pane-inner">
          <div className="tb-pane-mark">
            <Wordmark size="md" />
          </div>

          {children}

          <footer className="tb-pane-foot">
            <span className="tb-secured">
              <LockIcon />
              Secured by TokenBuzz · TLS 1.3
            </span>
            <span className="tb-foot-sep">·</span>
            <a href="#" className="tb-foot-link">Privacy</a>
            <a href="#" className="tb-foot-link">Terms</a>
          </footer>
        </div>
      </section>
    </div>
  )
}
