interface ClerkApiError {
  code?: string
  message?: string
  long_message?: string
  longMessage?: string
  meta?: { param_name?: string; paramName?: string }
}

interface ClerkErrorLike {
  message?: string
  longMessage?: string
  long_message?: string
  errors?: ClerkApiError[]
  code?: string
}

export function clerkErrorMessage(error: ClerkErrorLike | null | undefined): string | null {
  if (!error) return null

  if (process.env.NODE_ENV !== 'production') {
    try { console.error('[Clerk error]', JSON.stringify(error, null, 2)) } catch {}
  }

  if (Array.isArray(error.errors) && error.errors.length > 0) {
    const first = error.errors[0]
    return first.longMessage || first.long_message || first.message || 'Something went wrong.'
  }

  return error.longMessage || error.long_message || error.message || 'Something went wrong.'
}
