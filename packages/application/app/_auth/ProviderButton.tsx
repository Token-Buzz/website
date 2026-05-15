import { GoogleIcon, GitHubIcon, MicrosoftIcon } from './icons'

type Provider = 'google' | 'github' | 'microsoft'

const labels: Record<Provider, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
  microsoft: 'Continue with Microsoft',
}

const icons: Record<Provider, React.ReactNode> = {
  google: <GoogleIcon />,
  github: <GitHubIcon />,
  microsoft: <MicrosoftIcon />,
}

interface ProviderButtonProps {
  provider: Provider
  onClick: () => void
  disabled?: boolean
}

export function ProviderButton({ provider, onClick, disabled }: ProviderButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tb-provider-btn"
    >
      {icons[provider]}
      <span>{labels[provider]}</span>
    </button>
  )
}
