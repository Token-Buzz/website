'use client'

import { useState, useEffect } from 'react'
import { Eyebrow, Icon, Button, fmtPrice } from './primitives'

// ── Types ──────────────────────────────────────────────────────────────────

interface TokenCandidate {
  pool: string
  mint: string
  name: string
  baseSymbol: string | null
  baseName: string | null
  quoteSymbol: string | null
  dex: string | null
  priceUsd: number | null
  reserveUsd: number | null
  volume24hUsd: number | null
  chain: string
  source: string
}

interface TokenSearchResponse {
  candidates: TokenCandidate[]
  current: { pool: string; mint: string } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtCompactUsd(n: number | null): string | null {
  if (n === null || n === undefined) return null
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function truncateMint(mint: string): string {
  if (mint.length <= 10) return mint
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`
}

// ── TokenVerifyModal ────────────────────────────────────────────────────────

interface TokenVerifyModalProps {
  symbol: string
  onClose: () => void
  onSelected: () => void
}

export function TokenVerifyModal({ symbol, onClose, onSelected }: TokenVerifyModalProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<TokenCandidate[]>([])
  const [current, setCurrent] = useState<{ pool: string; mint: string } | null>(null)
  const [fetchSeq, setFetchSeq] = useState(0)
  const [selectingPool, setSelectingPool] = useState<string | null>(null)
  const [selectError, setSelectError] = useState<string | null>(null)

  // Escape-to-close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // Fetch candidates
  useEffect(() => {
    let cancelled = false

    async function fetchCandidates() {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/token-search/${encodeURIComponent(symbol)}`)
        if (cancelled) return
        if (!res.ok) {
          if (!cancelled) setLoadError(`Failed to load candidates (${res.status}).`)
          return
        }
        const data = (await res.json()) as TokenSearchResponse
        if (!cancelled) {
          setCandidates(data.candidates ?? [])
          setCurrent(data.current ?? null)
        }
      } catch {
        if (!cancelled) setLoadError('Network error. Could not load token candidates.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchCandidates()
    return () => {
      cancelled = true
    }
  }, [symbol, fetchSeq])

  async function handleSelectCandidate(candidate: TokenCandidate) {
    if (selectingPool !== null) return
    setSelectError(null)
    setSelectingPool(candidate.pool)
    try {
      const res = await fetch(`/api/token-search/${encodeURIComponent(symbol)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pool: candidate.pool, mint: candidate.mint, source: candidate.source }),
      })
      if (res.ok) {
        onSelected()
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setSelectError(data.error ?? `Failed to select token (${res.status}).`)
        setSelectingPool(null)
      }
    } catch {
      setSelectError('Network error. Please try again.')
      setSelectingPool(null)
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const isBusy = selectingPool !== null

  return (
    // Backdrop
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-modal-title"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 520,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <Eyebrow style={{ marginBottom: 4 }}>Verify token</Eyebrow>
            <h2
              id="verify-modal-title"
              style={{
                font: '600 18px/1.2 var(--font-sans)',
                color: 'var(--fg-1)',
                margin: 0,
                marginBottom: 6,
                letterSpacing: '-0.015em',
              }}
            >
              Which &ldquo;{symbol.toUpperCase()}&rdquo;?
            </h2>
            <p
              style={{
                font: '400 13px/1.5 var(--font-sans)',
                color: 'var(--fg-3)',
                margin: 0,
              }}
            >
              Anyone can name a Solana token. Pick the pool that matches the token you mean.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--fg-3)',
              padding: 4,
              borderRadius: 4,
              lineHeight: 0,
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div>
          {loading ? (
            // Skeleton loading rows
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 68,
                    borderRadius: 8,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    opacity: 0.5,
                  }}
                />
              ))}
            </div>
          ) : loadError ? (
            // Load error
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bear-100, rgba(220,53,69,0.1))',
                  border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
                  borderRadius: 6,
                  font: '500 13px/1.4 var(--font-sans)',
                  color: 'var(--bear-500, #dc3545)',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {loadError}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFetchSeq((n) => n + 1)}>
                Retry
              </Button>
            </div>
          ) : candidates.length === 0 ? (
            // Empty state
            <div
              style={{
                font: '400 13px/1.5 var(--font-sans)',
                color: 'var(--fg-3)',
                padding: '16px 0',
              }}
            >
              No matching tokens found for {symbol.toUpperCase()}.
            </div>
          ) : (
            // Candidate list
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {candidates.map((candidate) => {
                const isCurrent = current !== null && candidate.pool === current.pool
                const isSelecting = selectingPool === candidate.pool
                const isDisabled = isBusy
                const displayName = candidate.name || candidate.baseSymbol || candidate.mint

                return (
                  <button
                    key={candidate.pool}
                    onClick={() => void handleSelectCandidate(candidate)}
                    disabled={isDisabled}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 8,
                      background: 'var(--bg-elevated)',
                      border: isCurrent
                        ? '1px solid var(--buzz-500)'
                        : '1px solid var(--border)',
                      cursor: isDisabled ? 'default' : 'pointer',
                      opacity: isDisabled && !isSelecting ? 0.5 : 1,
                      transition: 'border-color 120ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled && !isCurrent) {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--buzz-500)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) {
                        ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                      }
                    }}
                  >
                    {/* Title row: name + dex chip + current pill */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          font: '600 14px/1.2 var(--font-sans)',
                          color: 'var(--fg-1)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayName}
                        {isSelecting && (
                          <span
                            style={{
                              font: '400 12px/1.2 var(--font-sans)',
                              color: 'var(--fg-3)',
                              marginLeft: 8,
                            }}
                          >
                            Selecting…
                          </span>
                        )}
                      </span>
                      {candidate.dex && (
                        <span
                          style={{
                            font: '500 11px/1 var(--font-sans)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'var(--bg-sunken, rgba(255,255,255,0.05))',
                            color: 'var(--fg-3)',
                            border: '1px solid var(--border)',
                            flexShrink: 0,
                          }}
                        >
                          {candidate.dex}
                        </span>
                      )}
                      {isCurrent && (
                        <span
                          style={{
                            font: '600 10px/1 var(--font-sans)',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(255,107,44,0.15)',
                            color: 'var(--buzz-500)',
                            flexShrink: 0,
                          }}
                        >
                          current
                        </span>
                      )}
                    </div>

                    {/* Mint address */}
                    <div
                      style={{
                        font: '500 11px/1.2 var(--font-mono)',
                        color: 'var(--fg-3)',
                        marginBottom: 4,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {truncateMint(candidate.mint)}
                    </div>

                    {/* Metrics row */}
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        font: '500 11px/1.2 var(--font-mono)',
                        color: 'var(--fg-3)',
                        flexWrap: 'wrap',
                      }}
                    >
                      {candidate.priceUsd !== null && (
                        <span>{fmtPrice(candidate.priceUsd)}</span>
                      )}
                      {candidate.reserveUsd !== null && (
                        <span>Liq {fmtCompactUsd(candidate.reserveUsd)}</span>
                      )}
                      {candidate.volume24hUsd !== null && (
                        <span>Vol {fmtCompactUsd(candidate.volume24hUsd)}</span>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* Select error */}
              {selectError && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'var(--bear-100, rgba(220,53,69,0.1))',
                    border: '1px solid var(--bear-300, rgba(220,53,69,0.3))',
                    borderRadius: 6,
                    font: '500 13px/1.4 var(--font-sans)',
                    color: 'var(--bear-500, #dc3545)',
                  }}
                >
                  {selectError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
