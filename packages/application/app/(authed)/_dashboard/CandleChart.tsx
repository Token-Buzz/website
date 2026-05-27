'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, CrosshairMode,
  createSeriesMarkers,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type CandlestickData, type HistogramData,
  type SeriesMarker, type ISeriesMarkersPluginApi, type Time,
} from 'lightweight-charts'
import { PRICE_INTERVALS, INTERVAL_SECONDS, type PriceInterval, type OHLCVBar } from '@monorepo-template/core/providers/price'
import type { SocialEvent } from '@monorepo-template/core/social-events'
import { Eyebrow, fmtPrice } from './primitives'
import {
  UP_COLOR, DOWN_COLOR, SMA_COLOR, EMA_COLOR, SMA_PERIOD, EMA_PERIOD,
  toCandleData, toVolumeData, pollIntervalMs, sma, ema, toChartMarkers,
  type CandlePoint,
} from './candleChart'

export interface CandleChartProps {
  symbol: string
  interval?: PriceInterval
  height?: number
}

interface SelectedEvents {
  events: SocialEvent[]
  point: { x: number; y: number }
}

export function CandleChart({ symbol, interval = '1h', height = 320 }: CandleChartProps) {
  const [tf, setTf] = useState<PriceInterval>(interval)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasData, setHasData] = useState(false)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; bar: CandlePoint; volume: number } | null>(null)
  const [containerWidth, setContainerWidth] = useState(300)
  const [showVolume, setShowVolume] = useState(true)
  const [showSma, setShowSma] = useState(false)
  const [showEma, setShowEma] = useState(false)
  const [showSocial, setShowSocial] = useState(true)
  const [selectedEvents, setSelectedEvents] = useState<SelectedEvents | null>(null)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [dataPaused, setDataPaused] = useState<{ retryAfterSec: number } | null>(null)
  const [retryCountdown, setRetryCountdown] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const emaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  // Retain loaded bars so indicators can recompute on toggle/poll without refetching
  const barsRef = useRef<OHLCVBar[]>([])
  // Track the last loaded bar time so polling updates only append/overwrite in-place
  const lastBarTimeRef = useRef<number>(0)
  // Social event refs
  const socialEventsRef = useRef<SocialEvent[]>([])
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  // Mirror the active timeframe in a ref so the click handler (created once in
  // the chart-setup effect) snaps event times with the current, not stale, tf.
  const tfRef = useRef<PriceInterval>(tf)

  // Chart creation effect — runs once (height changes apply via applyOptions)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0B0D0F' },
        textColor: '#A39378',
      },
      grid: {
        vertLines: { color: '#1C1A17' },
        horzLines: { color: '#1C1A17' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2A2620' },
      rightPriceScale: { borderColor: '#2A2620' },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    })
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    const smaSeries = chart.addSeries(LineSeries, {
      color: SMA_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    })

    const emaSeries = chart.addSeries(LineSeries, {
      color: EMA_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    })

    // Create the series markers plugin attached to the candle series
    const markersPlugin = createSeriesMarkers(candleSeries, [])
    markersPluginRef.current = markersPlugin

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    smaSeriesRef.current = smaSeries
    emaSeriesRef.current = emaSeries

    const crosshairHandler = (param: Parameters<Parameters<typeof chart.subscribeCrosshairMove>[0]>[0]) => {
      if (!param.point || !param.time || param.point.x < 0) {
        setTooltip(null)
        return
      }
      const candle = param.seriesData.get(candleSeries) as CandlestickData | undefined
      const vol = param.seriesData.get(volumeSeries) as HistogramData | undefined
      if (candle) {
        setTooltip({
          x: param.point.x,
          y: param.point.y,
          bar: {
            time: param.time as number,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          },
          volume: vol?.value ?? 0,
        })
      } else {
        setTooltip(null)
      }
    }
    chart.subscribeCrosshairMove(crosshairHandler)

    // Click handler: resolve markers → selectedEvents card
    const clickHandler = (param: Parameters<Parameters<typeof chart.subscribeClick>[0]>[0]) => {
      if (!param.point) {
        setSelectedEvents(null)
        return
      }

      const allEvents = socialEventsRef.current
      const intervalSecs = INTERVAL_SECONDS[tfRef.current]

      // Primary: match by hoveredObjectId (reliable when user clicks exactly on a marker)
      if (param.hoveredObjectId) {
        const id = param.hoveredObjectId as string
        const matched = allEvents.filter((ev) => `${ev.type}:${ev.ts}` === id)
        if (matched.length > 0) {
          setSelectedEvents({ events: matched, point: param.point })
          return
        }
      }

      // Fallback: match all events whose snapped ts === param.time
      if (param.time) {
        const clickedTs = param.time as number
        const matched = allEvents.filter(
          (ev) => Math.floor(ev.ts / intervalSecs) * intervalSecs === clickedTs,
        )
        if (matched.length > 0) {
          setSelectedEvents({ events: matched, point: param.point })
          return
        }
      }

      setSelectedEvents(null)
    }
    chart.subscribeClick(clickHandler)

    const observer = new ResizeObserver(() => {
      const w = container.clientWidth
      chart.applyOptions({ width: w })
      setContainerWidth(w)
    })
    observer.observe(container)
    // capture initial width in state
    setContainerWidth(container.clientWidth)

    return () => {
      chart.unsubscribeCrosshairMove(crosshairHandler)
      chart.unsubscribeClick(clickHandler)
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      smaSeriesRef.current = null
      emaSeriesRef.current = null
      markersPluginRef.current = null
    }
  }, [height])

  // Data-load effect — re-runs when symbol or timeframe changes
  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    // Defer the initial setState calls to a microtask so they are not
    // synchronous at the top of the effect body (avoids react-hooks/set-state-in-effect)
    Promise.resolve().then(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
    }).then(() => {
      if (cancelled) return
      return fetch(`/api/price/${encodeURIComponent(symbol)}?interval=${tf}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json() as Promise<{ bars: OHLCVBar[]; rateLimited: boolean; retryAfterSec: number }>
        })
        .then(({ bars, rateLimited, retryAfterSec }) => {
          if (cancelled) return
          if (rateLimited) {
            setDataPaused({ retryAfterSec })
            setRetryCountdown(retryAfterSec)
          } else {
            setDataPaused(null)
            setRetryCountdown(0)
          }
          const candles = toCandleData(bars).map((p) => ({ ...p, time: p.time as UTCTimestamp }))
          const volumes = toVolumeData(bars).map((p) => ({ ...p, time: p.time as UTCTimestamp }))
          candleSeriesRef.current?.setData(candles)
          volumeSeriesRef.current?.setData(volumes)
          barsRef.current = bars
          smaSeriesRef.current?.setData(sma(bars, SMA_PERIOD).map((p) => ({ ...p, time: p.time as UTCTimestamp })))
          emaSeriesRef.current?.setData(ema(bars, EMA_PERIOD).map((p) => ({ ...p, time: p.time as UTCTimestamp })))
          lastBarTimeRef.current = bars.length > 0 ? bars[bars.length - 1].ts : 0
          chartRef.current?.timeScale().fitContent()
          setHasData(bars.length > 0)
          setLoading(false)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          if (err instanceof Error && err.name === 'AbortError') return
          setError('Couldn\'t load price data')
          setLoading(false)
        })
    }).catch(() => { /* guard against effect-cancelled rejection */ })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [symbol, tf])

  // Polling effect — keeps the forming candle fresh
  useEffect(() => {
    let unmounted = false
    // Use window.setInterval to avoid collision with the global setInterval name
    const id = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/price/${encodeURIComponent(symbol)}?interval=${tf}`)
        if (!res.ok || unmounted) return
        const { bars, rateLimited, retryAfterSec } = (await res.json()) as { bars: OHLCVBar[]; rateLimited: boolean; retryAfterSec: number }
        if (unmounted) return
        if (rateLimited) {
          setDataPaused({ retryAfterSec })
          setRetryCountdown(retryAfterSec)
        } else {
          setDataPaused(null)
          setRetryCountdown(0)
        }
        const candles = toCandleData(bars).map((p) => ({ ...p, time: p.time as UTCTimestamp }))
        const volumes = toVolumeData(bars).map((p) => ({ ...p, time: p.time as UTCTimestamp }))
        for (let i = 0; i < candles.length; i++) {
          if (candles[i].time >= (lastBarTimeRef.current as UTCTimestamp)) {
            candleSeriesRef.current?.update(candles[i])
            if (volumes[i]) volumeSeriesRef.current?.update(volumes[i])
          }
        }
        if (bars.length > 0) {
          lastBarTimeRef.current = bars[bars.length - 1].ts
        }
        barsRef.current = bars
        smaSeriesRef.current?.setData(sma(bars, SMA_PERIOD).map((p) => ({ ...p, time: p.time as UTCTimestamp })))
        emaSeriesRef.current?.setData(ema(bars, EMA_PERIOD).map((p) => ({ ...p, time: p.time as UTCTimestamp })))
      } catch {
        // swallow — polling failures don't surface an error banner
      }
    }, pollIntervalMs(tf))

    return () => {
      unmounted = true
      window.clearInterval(id)
    }
  }, [symbol, tf])

  // Social events effect — re-runs when symbol or timeframe changes
  useEffect(() => {
    let cancelled = false

    const bars = barsRef.current
    const fromParam = bars.length > 0 ? bars[0].ts : undefined
    const toParam = bars.length > 0 ? bars[bars.length - 1].ts : undefined

    const url = fromParam !== undefined && toParam !== undefined
      ? `/api/social-events/${encodeURIComponent(symbol)}?from=${fromParam}&to=${toParam}`
      : `/api/social-events/${encodeURIComponent(symbol)}`

    fetch(url)
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { events: SocialEvent[] }
        if (cancelled) return
        const events = data.events ?? []
        socialEventsRef.current = events

        if (markersPluginRef.current) {
          const intervalSecs = INTERVAL_SECONDS[tf]
          const chartMarkers = toChartMarkers(events, intervalSecs)
          markersPluginRef.current.setMarkers(
            chartMarkers.map((m) => ({
              time: m.time as UTCTimestamp,
              position: m.position,
              shape: m.shape,
              color: m.color,
              id: m.id,
              ...(m.text !== undefined ? { text: m.text } : {}),
            })) as SeriesMarker<Time>[],
          )
        }
      })
      .catch(() => {
        // Social events are non-critical; silently fail
      })

    return () => {
      cancelled = true
    }
  }, [symbol, tf])

  // Visibility effect — sync series visibility with toggle state
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume })
    smaSeriesRef.current?.applyOptions({ visible: showSma })
    emaSeriesRef.current?.applyOptions({ visible: showEma })
  }, [showVolume, showSma, showEma])

  // Social toggle effect — show/hide markers without refetching
  useEffect(() => {
    if (!markersPluginRef.current) return
    if (!showSocial) {
      markersPluginRef.current.setMarkers([])
    } else {
      const intervalSecs = INTERVAL_SECONDS[tf]
      const chartMarkers = toChartMarkers(socialEventsRef.current, intervalSecs)
      markersPluginRef.current.setMarkers(
        chartMarkers.map((m) => ({
          time: m.time as UTCTimestamp,
          position: m.position,
          shape: m.shape,
          color: m.color,
          id: m.id,
          ...(m.text !== undefined ? { text: m.text } : {}),
        })) as SeriesMarker<UTCTimestamp>[],
      )
    }
  }, [showSocial, tf])

  // Countdown effect — ticks retryCountdown down to 0 once per second
  useEffect(() => {
    if (retryCountdown <= 0) return
    const id = window.setInterval(() => {
      setRetryCountdown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [retryCountdown])

  // Keep tfRef current for the click handler's stale closure
  useEffect(() => {
    tfRef.current = tf
  }, [tf])

  // Live-price polling effect — updates the header tick every 15 seconds
  useEffect(() => {
    let unmounted = false

    // Defer the reset so it isn't synchronous at the top of the effect body
    Promise.resolve().then(() => {
      if (!unmounted) setLivePrice(null)
    }).catch(() => { /* guard */ })

    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/price/${encodeURIComponent(symbol)}/live`)
        if (!res.ok || unmounted) return
        const data = (await res.json()) as { price: number | null }
        if (!unmounted && typeof data.price === 'number') {
          setLivePrice(data.price)
        }
      } catch {
        // silently ignore — best-effort tick
      }
    }

    void fetchLive()
    const id = window.setInterval(() => { void fetchLive() }, 15_000)
    return () => {
      unmounted = true
      window.clearInterval(id)
    }
  }, [symbol])

  return (
    <div style={{ background: 'var(--data-bg)', borderRadius: 10, padding: 16, color: 'var(--data-fg)', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eyebrow style={{ color: '#A39378' }}>{symbol.toUpperCase()}</Eyebrow>
            {livePrice !== null && (
              <span style={{ font: '600 13px var(--font-mono)', color: 'var(--data-fg)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtPrice(livePrice)}
              </span>
            )}
            <span style={{ font: '500 10px var(--font-mono)', color: '#A39378' }}>· live</span>
            {dataPaused && (
              <span style={{
                font: '500 10px var(--font-mono)',
                color: '#A39378',
                background: 'rgba(163,147,120,0.1)',
                borderRadius: 4,
                padding: '2px 6px',
              }}>
                live data paused — retrying in {retryCountdown}s
              </span>
            )}
          </div>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          {PRICE_INTERVALS.map((p) => (
            <span
              key={p}
              onClick={() => setTf(p)}
              style={{
                font: '600 11px var(--font-mono)',
                padding: '3px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                background: p === tf ? 'rgba(255,179,71,0.15)' : 'transparent',
                color: p === tf ? '#FFB347' : '#A39378',
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Indicator chip row */}
      <div style={{ display: 'inline-flex', gap: 6, marginBottom: 8 }}>
        {[
          { label: 'Volume', active: showVolume, toggle: () => setShowVolume((v) => !v), swatch: null },
          { label: 'SMA 20', active: showSma, toggle: () => setShowSma((v) => !v), swatch: SMA_COLOR },
          { label: 'EMA 50', active: showEma, toggle: () => setShowEma((v) => !v), swatch: EMA_COLOR },
          { label: 'Social', active: showSocial, toggle: () => setShowSocial((v) => !v), swatch: '#FFB347' },
        ].map(({ label, active, toggle, swatch }) => (
          <span
            key={label}
            onClick={toggle}
            style={{
              font: '600 11px var(--font-mono)',
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              background: active ? 'rgba(255,179,71,0.15)' : 'transparent',
              color: active ? '#FFB347' : '#A39378',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {swatch && (
              <span style={{
                background: swatch,
                borderRadius: 2,
                display: 'inline-block',
                width: 8,
                height: 8,
                marginRight: 4,
              }} />
            )}
            {label}
          </span>
        ))}
      </div>

      {/* Chart container — position relative for tooltip overlay */}
      <div style={{ position: 'relative', width: '100%', height }}>
        <div ref={containerRef} style={{ width: '100%', height }} />

        {/* Loading overlay — only shown when there's no data yet */}
        {loading && !hasData && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            font: '500 12px var(--font-mono)', color: '#A39378',
            pointerEvents: 'none',
          }}>
            Loading…
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            font: '500 12px var(--font-mono)', color: '#A39378',
            pointerEvents: 'none',
          }}>
            Couldn&#39;t load price data
          </div>
        )}

        {/* Empty state — loaded but zero bars */}
        {!loading && !error && hasData === false && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            font: '500 12px var(--font-mono)', color: '#A39378',
            pointerEvents: 'none',
          }}>
            No price data for {symbol}
          </div>
        )}

        {/* OHLCV crosshair tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              left: Math.min(tooltip.x + 12, containerWidth - 140),
              top: 8,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 8px',
              font: '500 11px var(--font-mono)',
              zIndex: 5,
              lineHeight: '1.6',
            }}
          >
            <div>O {fmtPrice(tooltip.bar.open)}</div>
            <div>H {fmtPrice(tooltip.bar.high)}</div>
            <div>L {fmtPrice(tooltip.bar.low)}</div>
            <div style={{ color: tooltip.bar.close >= tooltip.bar.open ? UP_COLOR : DOWN_COLOR }}>
              C {fmtPrice(tooltip.bar.close)}
            </div>
            <div style={{ color: '#A39378' }}>
              Vol {tooltip.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        )}

        {/* Social event click card */}
        {selectedEvents && (
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'auto',
              left: Math.min(selectedEvents.point.x + 12, containerWidth - 220),
              top: Math.max(8, selectedEvents.point.y - 20),
              background: 'var(--data-bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 12px',
              font: '500 11px var(--font-mono)',
              zIndex: 10,
              lineHeight: '1.6',
              maxWidth: 210,
              minWidth: 160,
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedEvents(null)}
              style={{
                position: 'absolute',
                top: 6,
                right: 8,
                background: 'transparent',
                border: 'none',
                color: '#A39378',
                cursor: 'pointer',
                font: '600 13px var(--font-mono)',
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>

            {selectedEvents.events.map((ev, i) => (
              <div
                key={`${ev.type}:${ev.ts}`}
                style={{
                  marginBottom: i < selectedEvents.events.length - 1 ? 8 : 0,
                  paddingBottom: i < selectedEvents.events.length - 1 ? 8 : 0,
                  borderBottom: i < selectedEvents.events.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Event title */}
                <div style={{ color: 'var(--fg-1)', fontWeight: 600, marginBottom: 2, paddingRight: 16 }}>
                  {ev.title}
                </div>

                {/* Magnitude line */}
                {ev.magnitude !== undefined && (
                  <div style={{ color: '#A39378', marginBottom: 2 }}>
                    {ev.type === 'SOCIAL_SPIKE'
                      ? `${ev.magnitude}σ spike`
                      : `Δ${ev.magnitude}`}
                  </div>
                )}

                {/* Tweet samples */}
                {ev.tweets && ev.tweets.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {ev.tweets.map((t) => (
                      <div key={t.tweetId} style={{ marginBottom: 3 }}>
                        <span style={{ color: '#5B8DEF', fontWeight: 600 }}>@{t.handle}</span>
                        {' '}
                        <span style={{ color: '#A39378' }}>
                          {t.text.length > 60 ? t.text.slice(0, 60) + '…' : t.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Footer link to live feed */}
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              <a
                href={`/live-feed?token=${encodeURIComponent(symbol)}`}
                style={{
                  color: '#FFB347',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: '0.03em',
                }}
              >
                View in live feed →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
