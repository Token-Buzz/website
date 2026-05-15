import { ArrowIcon, CheckIcon, SpinnerIcon } from './icons'

interface ContinueButtonProps {
  loading?: boolean
  success?: boolean
  disabled?: boolean
  label?: string
}

export function ContinueButton({ loading, success, disabled, label = 'Continue' }: ContinueButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading || success}
      className={`tb-continue${success ? ' is-success' : ''}`}
    >
      {success ? (
        <><CheckIcon /> <span>Verified</span></>
      ) : loading ? (
        <><SpinnerIcon /> <span>One sec…</span></>
      ) : (
        <><span>{label}</span> <ArrowIcon /></>
      )}
    </button>
  )
}
