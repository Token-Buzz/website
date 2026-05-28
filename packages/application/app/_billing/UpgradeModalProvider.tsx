'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Plan, BillingInterval } from '@monorepo-template/core/billing/tiers'
import { UpgradeModal } from './UpgradeModal'

interface OpenUpgradeOptions {
  currentPlan?: Plan
  initialInterval?: BillingInterval
  onClose?: () => void
}

interface UpgradeModalContextValue {
  openUpgrade: (opts?: OpenUpgradeOptions) => void
}

const UpgradeModalContext = createContext<UpgradeModalContextValue>({
  openUpgrade: () => {},
})

export function useUpgradeModal(): UpgradeModalContextValue {
  return useContext(UpgradeModalContext)
}

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<OpenUpgradeOptions>({})

  const openUpgrade = useCallback((o?: OpenUpgradeOptions) => {
    setOpts(o ?? {})
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    opts.onClose?.()
  }, [opts])

  return (
    <UpgradeModalContext.Provider value={{ openUpgrade }}>
      {children}
      <UpgradeModal
        open={open}
        onClose={handleClose}
        currentPlan={opts.currentPlan}
        initialInterval={opts.initialInterval}
      />
    </UpgradeModalContext.Provider>
  )
}
