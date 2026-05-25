'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Eyebrow, Ticker, Pill, Button, Icon, SectionHead,
} from '../_dashboard/primitives'
import { useIsMobile } from '@/app/_hooks/useIsMobile'

// ── Types ──────────────────────────────────────────────────────────────────

type AlertCondition = 'mention_spike' | 'sentiment_swing' | 'price_move'
type AlertTarget = 'bull' | 'bear' | 'any'

interface AlertRuleDTO {
  id: string
  symbol: string
  condition: AlertCondition
  threshold: number
  target?: AlertTarget
  channel: 'in_app'
  enabled: boolean
  createdAt: string
  lastTriggeredAt?: string
}

interface AlertTriggerDTO {
  sk: string
  alertId: string
  symbol: string
  condition: string
  message: string
  value: number
  link: string
  createdAt: string
  read: boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function timeSince(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function conditionLabel(rule: AlertRuleDTO): string {
  if (rule.condition === 'mention_spike') return `Buzz spike ≥ ${rule.threshold}%`
  if (rule.condition === 'price_move') return `Price move ≥ ${rule.threshold}%`
  if (rule.condition === 'sentiment_swing') {
    const t = rule.target ?? 'any'
    return t === 'any' ? 'Sentiment flip → any' : `Sentiment flip → ${t}`
  }
  return rule.condition
}

// ── State labels ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--fg-3)', font: '500 13px var(--font-sans)' }}>
      Loading…
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--neg)', font: '500 13px var(--font-sans)' }}>
      {message}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--fg-3)', font: '500 13px var(--font-sans)' }}>
      {children}
    </div>
  )
}

// ── Pill group (window selector style) ────────────────────────────────────

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: 'mention_spike',   label: 'Buzz spike' },
  { value: 'sentiment_swing', label: 'Sentiment flip' },
  { value: 'price_move',      label: 'Price move' },
]

const TARGETS: { value: AlertTarget; label: string }[] = [
  { value: 'any',  label: 'Any' },
  { value: 'bull', label: 'Bull' },
  { value: 'bear', label: 'Bear' },
]

function PillGroup<T extends string>({
  options, value, onChange, isMobile,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  isMobile: boolean
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        padding: 3,
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            border: 'none',
            padding: isMobile ? '5px 9px' : '5px 11px',
            borderRadius: 999,
            cursor: 'pointer',
            font: '600 11px var(--font-sans)',
            background: value === o.value ? 'var(--bg-elevated)' : 'transparent',
            color: value === o.value ? 'var(--fg-1)' : 'var(--fg-2)',
            boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
            transition: 'all 100ms',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Toggle switch ──────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      style={{
        width: 32,
        height: 18,
        borderRadius: 999,
        border: 'none',
        background: checked ? 'var(--buzz-500)' : 'var(--border-strong)',
        cursor: disabled ? 'default' : 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 150ms',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 150ms',
        }}
      />
    </button>
  )
}

// ── Rule builder form ──────────────────────────────────────────────────────

function RuleBuilder({
  isMobile,
  onCreated,
}: {
  isMobile: boolean
  onCreated: () => void
}) {
  const [symbol, setSymbol] = useState('')
  const [condition, setCondition] = useState<AlertCondition>('mention_spike')
  const [threshold, setThreshold] = useState<string>('100')
  const [target, setTarget] = useState<AlertTarget>('any')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const needsThreshold = condition === 'mention_spike' || condition === 'price_move'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!symbol.trim()) { setFormError('Symbol is required.'); return }
    setSubmitting(true)
    setFormError(null)
    try {
      const body: Record<string, unknown> = {
        symbol: symbol.trim().toUpperCase(),
        condition,
      }
      if (needsThreshold) body.threshold = Number(threshold)
      if (condition === 'sentiment_swing') body.target = target

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: `Request failed: ${res.status}` }))
        throw new Error((json as { error?: string }).error ?? `Request failed: ${res.status}`)
      }
      setSymbol('')
      setThreshold('100')
      setTarget('any')
      onCreated()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    font: '500 13px var(--font-sans)',
    color: 'var(--fg-1)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px 10px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Symbol */}
        <div>
          <label style={{ font: '600 11px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', display: 'block', marginBottom: 6 }}>
            Symbol
          </label>
          <input
            type="text"
            placeholder="$PEPE"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={{ ...inputStyle, maxWidth: isMobile ? '100%' : 200 }}
          />
        </div>

        {/* Condition */}
        <div>
          <label style={{ font: '600 11px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', display: 'block', marginBottom: 6 }}>
            Condition
          </label>
          <PillGroup<AlertCondition>
            options={CONDITIONS}
            value={condition}
            onChange={setCondition}
            isMobile={isMobile}
          />
        </div>

        {/* Threshold (buzz spike / price move) */}
        {needsThreshold && (
          <div>
            <label style={{ font: '600 11px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', display: 'block', marginBottom: 6 }}>
              Threshold %
            </label>
            <input
              type="number"
              min={1}
              placeholder="100"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              style={{ ...inputStyle, maxWidth: isMobile ? '100%' : 140 }}
            />
          </div>
        )}

        {/* Target (sentiment swing) */}
        {condition === 'sentiment_swing' && (
          <div>
            <label style={{ font: '600 11px var(--font-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-3)', display: 'block', marginBottom: 6 }}>
              Target sentiment
            </label>
            <PillGroup<AlertTarget>
              options={TARGETS}
              value={target}
              onChange={setTarget}
              isMobile={isMobile}
            />
          </div>
        )}

        {/* Actions row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon="plus"
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create alert'}
          </Button>
          {formError && (
            <span style={{ font: '500 12px var(--font-sans)', color: 'var(--neg)' }}>
              {formError}
            </span>
          )}
        </div>
      </div>
    </form>
  )
}

// ── Alert rules list ───────────────────────────────────────────────────────

function RuleRow({
  rule,
  onToggle,
  onDelete,
}: {
  rule: AlertRuleDTO
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
}) {
  const [togglingLocal, setTogglingLocal] = useState(false)
  const [deletingLocal, setDeletingLocal] = useState(false)

  const targetTone: Record<AlertTarget, 'bull' | 'bear' | 'neu'> = { bull: 'bull', bear: 'bear', any: 'neu' }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-hairline)',
        flexWrap: 'wrap',
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Symbol */}
      <Ticker symbol={rule.symbol} size="sm" />

      {/* Condition label */}
      <span style={{ font: '500 12px var(--font-sans)', color: 'var(--fg-2)', flex: 1, minWidth: 120 }}>
        {conditionLabel(rule)}
      </span>

      {/* Sentiment target pill (sentiment_swing only) */}
      {rule.condition === 'sentiment_swing' && rule.target && (
        <Pill tone={targetTone[rule.target] ?? 'neu'} style={{ fontSize: 10 }}>
          {rule.target}
        </Pill>
      )}

      {/* Enabled toggle */}
      <ToggleSwitch
        checked={rule.enabled}
        disabled={togglingLocal}
        onChange={async (v) => {
          setTogglingLocal(true)
          onToggle(rule.id, v)
          try {
            await fetch(`/api/alerts/${rule.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled: v }),
            })
          } catch {
            // revert on failure via re-fetch (parent refetches)
            onToggle(rule.id, !v)
          } finally {
            setTogglingLocal(false)
          }
        }}
      />

      {/* Delete */}
      <button
        disabled={deletingLocal}
        onClick={async () => {
          setDeletingLocal(true)
          try {
            await fetch(`/api/alerts/${rule.id}`, { method: 'DELETE' })
            onDelete(rule.id)
          } catch {
            setDeletingLocal(false)
          }
        }}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: deletingLocal ? 'default' : 'pointer',
          color: deletingLocal ? 'var(--fg-4)' : 'var(--fg-3)',
          display: 'flex',
          alignItems: 'center',
          padding: 4,
          borderRadius: 4,
          transition: 'color 100ms',
          opacity: deletingLocal ? 0.5 : 1,
        }}
        onMouseEnter={(e) => {
          if (!deletingLocal) (e.currentTarget as HTMLButtonElement).style.color = 'var(--neg)'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-3)'
        }}
        aria-label="Delete alert rule"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  )
}

// ── Trigger row ────────────────────────────────────────────────────────────

function TriggerRow({
  trigger,
  onRead,
}: {
  trigger: AlertTriggerDTO
  onRead: (sk: string) => void
}) {
  const router = useRouter()

  async function handleClick() {
    if (!trigger.read) {
      onRead(trigger.sk)
      void fetch('/api/alerts/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sk: trigger.sk }),
      })
    }
    router.push(trigger.link)
  }

  return (
    <div
      onClick={() => { void handleClick() }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-hairline)',
        cursor: 'pointer',
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Unread dot */}
      <div style={{ width: 8, height: 8, marginTop: 5, flexShrink: 0 }}>
        {!trigger.read && (
          <span
            style={{
              display: 'block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--buzz-500)',
            }}
          />
        )}
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: `${trigger.read ? '400' : '600'} 13px/1.4 var(--font-sans)`,
            color: trigger.read ? 'var(--fg-2)' : 'var(--fg-1)',
            wordBreak: 'break-word',
          }}
        >
          {trigger.message}
        </div>
      </div>

      {/* Timestamp */}
      <span style={{ font: '500 11px var(--font-mono)', color: 'var(--fg-4)', whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0 }}>
        {timeSince(trigger.createdAt)}
      </span>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const isMobile = useIsMobile()

  // Rules state
  const [rules, setRules] = useState<AlertRuleDTO[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesError, setRulesError] = useState<string | null>(null)
  const [rulesSeq, setRulesSeq] = useState(0)

  // Triggers state
  const [triggers, setTriggers] = useState<AlertTriggerDTO[]>([])
  const [triggersLoading, setTriggersLoading] = useState(true)
  const [triggersError, setTriggersError] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  // ── Fetch rules ────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setRulesLoading(true)
      setRulesError(null)
      try {
        const res = await fetch('/api/alerts')
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data = await res.json() as { alerts: AlertRuleDTO[] }
        if (!cancelled) setRules(data.alerts ?? [])
      } catch (err) {
        if (!cancelled) setRulesError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        if (!cancelled) setRulesLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [rulesSeq])

  // ── Fetch triggers ─────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    async function load() {
      setTriggersLoading(true)
      setTriggersError(null)
      try {
        const res = await fetch('/api/alerts/triggers?limit=50')
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data = await res.json() as { triggers: AlertTriggerDTO[] }
        if (!cancelled) setTriggers(data.triggers ?? [])
      } catch (err) {
        if (!cancelled) setTriggersError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        if (!cancelled) setTriggersLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // ── Rule helpers ───────────────────────────────────────────────────────

  function handleToggle(id: string, enabled: boolean) {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled } : r))
  }

  function handleDelete(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id))
  }

  // ── Trigger helpers ────────────────────────────────────────────────────

  function handleRead(sk: string) {
    setTriggers((prev) => prev.map((t) => t.sk === sk ? { ...t, read: true } : t))
  }

  async function handleMarkAll() {
    setMarkingAll(true)
    setTriggers((prev) => prev.map((t) => ({ ...t, read: true })))
    try {
      await fetch('/api/alerts/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch {
      // optimistic; leave local state as read
    } finally {
      setMarkingAll(false)
    }
  }

  const hasUnread = triggers.some((t) => !t.read)
  const gap = isMobile ? 16 : 24

  return (
    <div
      style={{
        padding: isMobile ? '16px 12px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        gap,
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <Eyebrow style={{ marginBottom: 8 }}>Alerts</Eyebrow>
        <h1
          style={{
            font: `600 ${isMobile ? '22px' : '28px'}/1.15 var(--font-sans)`,
            letterSpacing: '-0.015em',
            color: 'var(--fg-1)',
            margin: 0,
          }}
        >
          Alert rules
        </h1>
      </div>

      {/* ── Section 1: Rule builder + list ───────────────────────────────── */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        {/* Builder */}
        <div style={{ padding: isMobile ? '16px' : '20px', borderBottom: '1px solid var(--border)' }}>
          <SectionHead eyebrow="New rule" />
          <RuleBuilder isMobile={isMobile} onCreated={() => setRulesSeq((s) => s + 1)} />
        </div>

        {/* List */}
        <div>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Eyebrow>Active rules</Eyebrow>
          </div>
          {rulesLoading ? (
            <LoadingState />
          ) : rulesError ? (
            <ErrorState message={rulesError} />
          ) : rules.length === 0 ? (
            <EmptyState>No alert rules yet — create one above.</EmptyState>
          ) : (
            rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </Card>

      {/* ── Section 2: Inbox ─────────────────────────────────────────────── */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Eyebrow>Inbox</Eyebrow>
          <div style={{ flex: 1 }} />
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { void handleMarkAll() }}
              disabled={markingAll}
            >
              {markingAll ? 'Marking…' : 'Mark all read'}
            </Button>
          )}
        </div>

        {triggersLoading ? (
          <LoadingState />
        ) : triggersError ? (
          <ErrorState message={triggersError} />
        ) : triggers.length === 0 ? (
          <EmptyState>No alerts triggered yet.</EmptyState>
        ) : (
          triggers.map((trigger) => (
            <TriggerRow
              key={trigger.sk}
              trigger={trigger}
              onRead={handleRead}
            />
          ))
        )}
      </Card>
    </div>
  )
}
