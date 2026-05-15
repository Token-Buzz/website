import { useMemo } from 'react'

const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']

export function usePasswordStrength(password: string) {
  return useMemo(() => {
    if (!password) return null
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return { score, label: labels[score] }
  }, [password])
}
