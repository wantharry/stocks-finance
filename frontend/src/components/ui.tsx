import clsx from 'clsx'
import type { Recommendation } from '../types'

export const REC_COLORS: Record<string, string> = {
  'Strong Buy': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
  'Buy': 'bg-green-500/20 text-green-300 border border-green-500/40',
  'Hold': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  'Sell': 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
  'Strong Sell': 'bg-red-500/20 text-red-300 border border-red-500/40',
}

export const REC_DOT: Record<string, string> = {
  'Strong Buy': 'bg-emerald-400',
  'Buy': 'bg-green-400',
  'Hold': 'bg-yellow-400',
  'Sell': 'bg-orange-400',
  'Strong Sell': 'bg-red-400',
}

export function RecBadge({ rec }: { rec: string | null }) {
  if (!rec) return <span className="text-slate-500">—</span>
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap', REC_COLORS[rec])}>
      {rec}
    </span>
  )
}

export function fmt(v: number | null | undefined, decimals = 2, suffix = ''): string {
  if (v == null) return '—'
  return v.toFixed(decimals) + suffix
}

export function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return sign + v.toFixed(2) + '%'
}

export function fmtCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtMarketCap(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M'
  return '$' + v.toLocaleString()
}

export function fmtVolume(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toString()
}

export function changeColor(v: number | null | undefined): string {
  if (v == null) return 'text-slate-400'
  return v >= 0 ? 'text-emerald-400' : 'text-red-400'
}

export function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-500">—</span>
  const color =
    score >= 70 ? 'bg-emerald-500' :
    score >= 55 ? 'bg-green-500' :
    score >= 45 ? 'bg-yellow-500' :
    score >= 30 ? 'bg-orange-500' :
    'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs w-8 text-right text-slate-300">{score.toFixed(0)}</span>
    </div>
  )
}

export function RsiIndicator({ rsi }: { rsi: number | null }) {
  if (rsi == null) return <span className="text-slate-500">—</span>
  const color =
    rsi <= 30 ? 'text-emerald-400' :
    rsi >= 70 ? 'text-red-400' :
    'text-slate-300'
  const label =
    rsi <= 30 ? 'Oversold' :
    rsi >= 70 ? 'Overbought' :
    'Neutral'
  return (
    <span className={clsx('font-mono text-sm', color)} title={label}>
      {rsi.toFixed(1)}
    </span>
  )
}
