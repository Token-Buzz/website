import { AuthShell } from './AuthShell'
import { AuthCard } from './AuthCard'
import { SpinnerIcon } from './icons'

interface AuthLoadingProps {
  message?: string
}

export function AuthLoading({ message = 'Loading…' }: AuthLoadingProps) {
  return (
    <AuthShell>
      <AuthCard>
        <div className="tb-card-body">
          <div className="tb-auth-loading">
            <SpinnerIcon size={28} />
            <p className="tb-auth-loading-msg">{message}</p>
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  )
}
