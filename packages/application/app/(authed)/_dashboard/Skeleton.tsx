'use client'

import type { CSSProperties } from 'react'

// ── Base Skeleton block ────────────────────────────────────────────────────

export function Skeleton({
  width,
  height = 16,
  radius = 'var(--r-2)',
  style,
  className,
}: {
  width?: number | string
  height?: number | string
  radius?: number | string
  style?: CSSProperties
  className?: string
}) {
  return (
    <div
      className={'tb-skeleton ' + (className ?? '')}
      style={{
        width: width !== undefined ? width : '100%',
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface) 25%, var(--surface-hover) 37%, var(--surface) 63%)',
        backgroundSize: '200% 100%',
        animation: 'tb-shimmer 1.4s ease-in-out infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

// ── SkeletonText — multiple lines ──────────────────────────────────────────

export function SkeletonText({
  lines = 3,
  width,
  lastLineWidth = '60%',
  gap = 8,
  style,
}: {
  lines?: number
  width?: number | string
  lastLineWidth?: string
  gap?: number
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={13}
          width={i === lines - 1 ? lastLineWidth : (width ?? '100%')}
        />
      ))}
    </div>
  )
}

// ── SkeletonCard ───────────────────────────────────────────────────────────

export function SkeletonCard({
  style,
  lines = 2,
  bodyHeight = 80,
}: {
  style?: CSSProperties
  lines?: number
  bodyHeight?: number
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-3)',
        background: 'var(--bg-elevated)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {/* Title bar */}
      <Skeleton width={120} height={14} />
      {/* Text lines */}
      <SkeletonText lines={lines} lastLineWidth="50%" />
      {/* Body block */}
      <Skeleton height={bodyHeight} radius="var(--r-2)" />
    </div>
  )
}

// ── PageSkeleton — generic full-page loading fallback ─────────────────────

export function PageSkeleton({
  title = true,
  cards = 6,
}: {
  title?: boolean
  cards?: number
}) {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      {title && (
        <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton width={180} height={24} />
          <Skeleton width={260} height={14} />
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
