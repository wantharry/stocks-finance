import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react'
import { fetchStockDetail } from '../api/client'
import StockChart from './StockChart'
import {
  changeColor, fmt, fmtCurrency, fmtMarketCap, fmtPct, fmtVolume,
  RecBadge, REC_DOT, RsiIndicator, ScoreBar,
} from './ui'
import clsx from 'clsx'

interface Props {
  ticker: string
  onBack: () => void
}

function MetricRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <div className="text-right">
        <span className="text-slate-100 text-sm font-medium">{value}</span>
        {note && <p className="text-slate-500 text-xs">{note}</p>}
      </div>
    </div>
  )
}

export default function StockDetail({ ticker, onBack }: Props) {
  const { data: s, isLoading, isError, refetch } = useQuery({
    queryKey: ['stockDetail', ticker],
    queryFn: () => fetchStockDetail(ticker),
  })

  if (isLoading) return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft size={18} /> Back to Dashboard
      </button>
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-bg-card rounded-xl" />
        <div className="h-96 bg-bg-card rounded-xl" />
      </div>
    </div>
  )

  if (isError || !s) return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-6 transition-colors">
        <ArrowLeft size={18} /> Back
      </button>
      <div className="bg-bg-card rounded-xl border border-red-500/30 p-8 text-center">
        <p className="text-red-300 mb-2">Data not available for {ticker}</p>
        <p className="text-slate-500 text-sm">The initial data refresh may still be running. Please wait and try again.</p>
        <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-bg-hover rounded-lg text-slate-300 hover:text-white transition-colors text-sm">
          Retry
        </button>
      </div>
    </div>
  )

  const maSignal = (() => {
    if (!s.sma_50 || !s.sma_200 || !s.current_price) return null
    if (s.current_price > s.sma_50 && s.sma_50 > s.sma_200) return { label: 'Golden Cross — Uptrend', color: 'text-emerald-400' }
    if (s.current_price < s.sma_50 && s.sma_50 < s.sma_200) return { label: 'Death Cross — Downtrend', color: 'text-red-400' }
    return { label: 'Mixed signals', color: 'text-yellow-400' }
  })()

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 mb-5 transition-colors text-sm">
        <ArrowLeft size={16} /> Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-bg-card rounded-xl border border-slate-700/50 p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-white">{s.ticker}</h1>
              {s.recommendation && (
                <div className="flex items-center gap-1.5">
                  <div className={clsx('w-2 h-2 rounded-full', REC_DOT[s.recommendation])} />
                  <RecBadge rec={s.recommendation} />
                </div>
              )}
              <a
                href={`https://finance.yahoo.com/quote/${s.ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title="View on Yahoo Finance"
              >
                <ExternalLink size={14} />
              </a>
            </div>
            <p className="text-slate-400">{s.name ?? ticker}</p>
            {s.sector && (
              <p className="text-xs text-slate-500 mt-0.5">{s.sector} · {s.industry}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{fmtCurrency(s.current_price)}</div>
            <div className={clsx('text-lg mt-0.5', changeColor(s.price_change_pct))}>
              {s.price_change != null && (s.price_change >= 0 ? '+' : '')}{s.price_change?.toFixed(2)} ({fmtPct(s.price_change_pct)})
            </div>
          </div>
        </div>

        {/* Score strip */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-700/40">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Technical Score</p>
            <ScoreBar score={s.technical_score} />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Fundamental Score</p>
            <ScoreBar score={s.fundamental_score} />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Overall Score</p>
            <ScoreBar score={s.overall_score} />
          </div>
        </div>

        {/* Confidence */}
        {s.confidence != null && (
          <p className="text-xs text-slate-500 mt-3">
            Signal confidence: {s.confidence.toFixed(0)}% of technical indicators agree
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Charts */}
        <div className="lg:col-span-2 bg-bg-card rounded-xl border border-slate-700/50 p-5">
          <h2 className="font-semibold text-slate-200 mb-4">Price Chart & Indicators</h2>
          <StockChart ticker={ticker} />
        </div>

        {/* Right: Fundamentals + Technical signals */}
        <div className="space-y-4">
          {/* Technical */}
          <div className="bg-bg-card rounded-xl border border-slate-700/50 p-4">
            <h3 className="font-semibold text-slate-200 mb-3">Technical Signals</h3>
            <div>
              <MetricRow label="RSI (14)" value={s.rsi != null ? `${s.rsi.toFixed(1)} ${s.rsi <= 30 ? '— Oversold 🟢' : s.rsi >= 70 ? '— Overbought 🔴' : '— Neutral'}` : '—'} />
              <MetricRow
                label="MACD"
                value={s.macd != null && s.macd_signal != null
                  ? `${s.macd > s.macd_signal ? '▲ Bullish' : '▼ Bearish'}`
                  : '—'}
                note={s.macd != null ? `${s.macd.toFixed(4)} / Signal ${s.macd_signal?.toFixed(4)}` : undefined}
              />
              <MetricRow
                label="Moving Avg"
                value={maSignal?.label ?? '—'}
                note={s.sma_50 != null ? `50MA: $${s.sma_50.toFixed(2)} · 200MA: $${s.sma_200?.toFixed(2) ?? '—'}` : undefined}
              />
              <MetricRow
                label="Bollinger"
                value={s.bb_upper != null ? `Width: ${s.bb_width?.toFixed(1)}%` : '—'}
                note={s.bb_upper != null ? `$${s.bb_lower?.toFixed(2)} – $${s.bb_upper?.toFixed(2)}` : undefined}
              />
              <MetricRow label="Beta" value={s.beta != null ? s.beta.toFixed(2) : '—'} />
              <MetricRow label="52W High" value={fmtCurrency(s.week52_high)} />
              <MetricRow label="52W Low" value={fmtCurrency(s.week52_low)} />
              <MetricRow label="Volume" value={fmtVolume(s.volume)} note={`Avg: ${fmtVolume(s.avg_volume)}`} />
            </div>
          </div>

          {/* Fundamental */}
          <div className="bg-bg-card rounded-xl border border-slate-700/50 p-4">
            <h3 className="font-semibold text-slate-200 mb-3">Fundamentals</h3>
            <div>
              <MetricRow label="Market Cap" value={fmtMarketCap(s.market_cap)} />
              <MetricRow label="P/E Ratio" value={fmt(s.pe_ratio, 2)} note={s.forward_pe != null ? `Forward P/E: ${s.forward_pe.toFixed(2)}` : undefined} />
              <MetricRow label="P/B Ratio" value={fmt(s.pb_ratio, 2)} />
              <MetricRow label="P/S Ratio" value={fmt(s.ps_ratio, 2)} />
              <MetricRow label="PEG Ratio" value={fmt(s.peg_ratio, 2)} />
              <MetricRow
                label="Revenue Growth"
                value={s.revenue_growth != null ? fmtPct(s.revenue_growth * 100) : '—'}
              />
              <MetricRow
                label="Earnings Growth"
                value={s.earnings_growth != null ? fmtPct(s.earnings_growth * 100) : '—'}
              />
              <MetricRow label="ROE" value={s.roe != null ? fmtPct(s.roe * 100) : '—'} />
              <MetricRow label="Profit Margin" value={s.profit_margin != null ? fmtPct(s.profit_margin * 100) : '—'} />
              <MetricRow label="Debt / Equity" value={fmt(s.debt_equity, 2)} />
              <MetricRow label="Dividend Yield" value={s.dividend_yield != null ? fmtPct(s.dividend_yield * 100) : 'None'} />
            </div>
          </div>

          {/* Description */}
          {s.description && (
            <div className="bg-bg-card rounded-xl border border-slate-700/50 p-4">
              <h3 className="font-semibold text-slate-200 mb-2">About</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
