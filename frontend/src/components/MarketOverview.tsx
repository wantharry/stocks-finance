import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { fetchIndices } from '../api/client'
import { changeColor, fmtPct } from './ui'
import clsx from 'clsx'

export default function MarketOverview() {
  const { data: indices = [] } = useQuery({
    queryKey: ['indices'],
    queryFn: fetchIndices,
    refetchInterval: 60_000,
  })

  if (indices.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-bg-card rounded-xl p-4 animate-pulse h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      {indices.map((idx) => {
        const up = (idx.change_pct ?? 0) >= 0
        return (
          <div key={idx.symbol} className="bg-bg-card rounded-xl p-4 border border-slate-700/50">
            <div className="text-xs text-slate-400 mb-1 truncate">{idx.name}</div>
            <div className="text-lg font-bold text-slate-100">
              {idx.price != null ? idx.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
            </div>
            <div className={clsx('flex items-center gap-1 text-sm mt-0.5', changeColor(idx.change_pct))}>
              {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {fmtPct(idx.change_pct)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
