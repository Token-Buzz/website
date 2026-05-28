'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'

export function DangerZoneSection() {
  // ── Export state ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [exportError, setExportError] = useState<string | undefined>(undefined)

  // ── Delete state ────────────────────────────────────────────────────────────
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined)

  const { signOut } = useClerk()

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    setExportDone(false)
    setExportError(undefined)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setExportError(body.error ?? 'Export failed. Please try again.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tokenbuzz-data-export.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } catch {
      setExportError('Network error. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (confirmText !== 'DELETE') return
    setDeleting(true)
    setDeleteError(undefined)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setDeleteError(body.error ?? 'Account deletion failed. Please try again.')
        setDeleting(false)
        return
      }
      // Success: sign out and redirect to the marketing site.
      await signOut()
      window.location.href = '/'
    } catch {
      setDeleteError('Network error. Please try again.')
      setDeleting(false)
    }
  }

  const deleteEnabled = confirmText === 'DELETE' && !deleting

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <h2
          style={{
            margin: 0,
            font: '600 var(--fs-h4) / var(--lh-snug) var(--font-sans)',
            color: 'var(--fg-1)',
            letterSpacing: '-0.015em',
          }}
        >
          Danger Zone
        </h2>
        <p
          style={{
            margin: 'var(--sp-2) 0 0',
            font: '400 var(--fs-small) / var(--lh-body) var(--font-sans)',
            color: 'var(--fg-3)',
          }}
        >
          These actions are permanent and cannot be undone.
        </p>
      </div>

      {/* ── Export card ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-3)',
          padding: 'var(--sp-5)',
          marginBottom: 'var(--sp-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              font: '600 var(--fs-small) / 1 var(--font-sans)',
              color: 'var(--fg-1)',
              letterSpacing: '-0.005em',
            }}
          >
            Export my data
          </p>
          <p
            style={{
              margin: 'var(--sp-2) 0 0',
              font: '400 var(--fs-small) / var(--lh-body) var(--font-sans)',
              color: 'var(--fg-3)',
            }}
          >
            Download a JSON file containing all your TokenBuzz data — alerts,
            watchlist, dashboard configurations, and more. Encrypted API key
            material is excluded.
          </p>
        </div>

        {exportError && (
          <p
            style={{
              margin: 0,
              font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
              color: 'var(--neg)',
            }}
          >
            {exportError}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{
              appearance: 'none',
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-2)',
              padding: '8px 14px',
              font: '500 var(--fs-small) var(--font-sans)',
              color: exporting ? 'var(--fg-3)' : 'var(--fg-1)',
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {exporting ? 'Preparing…' : exportDone ? 'Download started' : 'Download my data'}
          </button>
        </div>
      </div>

      {/* ── Delete account card ── */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-3)',
          padding: 'var(--sp-5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              font: '600 var(--fs-small) / 1 var(--font-sans)',
              color: 'var(--neg)',
              letterSpacing: '-0.005em',
            }}
          >
            Delete my account
          </p>
          <p
            style={{
              margin: 'var(--sp-2) 0 0',
              font: '400 var(--fs-small) / var(--lh-body) var(--font-sans)',
              color: 'var(--fg-3)',
            }}
          >
            Permanently deletes your account, all stored data, and cancels any
            active subscription. This action{' '}
            <strong style={{ color: 'var(--fg-2)' }}>cannot be undone</strong>.
          </p>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              font: '400 var(--fs-micro) / 1 var(--font-sans)',
              color: 'var(--fg-3)',
              marginBottom: 'var(--sp-2)',
            }}
          >
            Type <strong style={{ color: 'var(--fg-2)', fontFamily: 'var(--font-mono)' }}>DELETE</strong> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value)
              setDeleteError(undefined)
            }}
            placeholder="DELETE"
            disabled={deleting}
            autoComplete="off"
            spellCheck={false}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: '240px',
              boxSizing: 'border-box',
              padding: '8px 12px',
              font: '400 var(--fs-small) / 1 var(--font-mono)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-1)',
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-2)',
              outline: 'none',
              letterSpacing: '0.04em',
            }}
          />
        </div>

        {deleteError && (
          <p
            style={{
              margin: 0,
              font: '400 var(--fs-micro) / var(--lh-body) var(--font-sans)',
              color: 'var(--neg)',
            }}
          >
            {deleteError}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!deleteEnabled}
            style={{
              appearance: 'none',
              background: deleteEnabled ? 'var(--neg)' : 'transparent',
              border: `1px solid ${deleteEnabled ? 'var(--neg)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--r-2)',
              padding: '8px 14px',
              font: '500 var(--fs-small) var(--font-sans)',
              color: deleteEnabled ? '#fff' : 'var(--fg-3)',
              cursor: deleteEnabled ? 'pointer' : 'not-allowed',
              opacity: deleting ? 0.6 : 1,
              transition: 'background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s',
            }}
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  )
}
