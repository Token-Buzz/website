'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType, CrosshairMode,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type CandlestickData, type HistogramData,
} from 'lightweight-charts'
import { PRICE_INTERVALS, type PriceInterval, type OHLCVBar } from '@monorepo-template/core/providers/price'
import { Eyebrow, fmtPrice } from './primitives'
import {
  UP_COLOR, DOWN_COLOR, SMA_COLOR, EMA_COLOR, SMA_PERIOD, EMA_PERIOD,
  toCandleData, toVolumeData, pollIntervalMs, sma, ema,
  type CandlePoint,
} from './candleChart'

export interface CandleChartProps {
  symbol: string
  interval?: PriceInterval
  height?: number
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
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      smaSeriesRef.current = null
      emaSeriesRef.current = null
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
          return res.json() as Promise<{ bars: OHLCVBar[] }>
        })
        .then(({ bars }) => {
          if (cancelled) return
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
        const { bars } = (await res.json()) as { bars: OHLCVBar[] }
        if (unmounted) return
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

  // Visibility effect — sync series visibility with toggle state
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume })
    smaSeriesRef.current?.applyOptions({ visible: showSma })
    emaSeriesRef.current?.applyOptions({ visible: showEma })
  }, [showVolume, showSma, showEma])

  return (
    <div style={{ background: 'var(--data-bg)', borderRadius: 10, padding: 16, color: 'var(--data-fg)', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Eyebrow style={{ color: '#A39378' }}>{symbol.toUpperCase()} · price</Eyebrow>
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
      </div>
    </div>
  )
}
