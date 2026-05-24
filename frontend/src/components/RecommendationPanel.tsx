import { useQuery } from '@tanstack/react-query'
import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { fetchRecommendations } from '../api/client'
import { changeColor, fmtCurrency, fmtPct, RecBadge, ScoreBar } from './ui'
import clsx from 'clsx'

interface Props {
  onSelectTicker: (t: string) => void
}

export default function RecommendationPanel({ onSelectTicker }: Props) {
  const { data } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => fetchRecommendations(8),
    refetchInterval: 5 * 60_000,
  })

  const buys = data?.buy ?? []
  const sells = data?.sell ?? []

  const Card = ({ s, mode }: { s: any; mode: 'buy' | 'sell' }) => (
    <button
      onClick={() => onSelectTicker(s.ticker)}
      className="w-full text-left bg-bg-primary hover:bg-bg-hover rounded-lg p-3 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <span className="font-bold text-slate-100 group-hover:text-accent-blue transition-colors">
            {s.ticker}
          </span>
          <span className="text-xs text-slate-400 ml-2 truncate max-w-[100px] inline-block align-middle">
            {s.name ?? ''}
          </span>
        </div>
        <RecBadge rec={s.recommendation} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-200">{fmtCurrency(s.current_price)}</span>
        <span className={clsx('text-xs', changeColor(s.price_change_pct))}>
          {fmtPct(s.price_change_pct)}
        </span>
      </div>
      <div className="mt-2">
        <ScoreBar score={s.overall_score} />
      </div>
    </button>
  )

  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {/* Top Buys */}
      <div className="bg-bg-card rounded-xl border border-emerald-500/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpCircle size={18} className="text-emerald-400" />
          <h3 className="font-semibold text-emerald-300">Top Buy Opportunities</h3>
        </div>
        {buys.length === 0 ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <div className="space-y-1">
            {buys.map((s) => <Card key={s.ticker} s={s} mode="buy" />)}
          </div>
        )}
      </div>

      {/* Top Sells */}
      <div className="bg-bg-card rounded-xl border border-red-500/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownCircle size={18} className="text-red-400" />
          <h3 className="font-semibold text-red-300">Stocks to Avoid / Sell</h3>
        </div>
        {sells.length === 0 ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <div className="space-y-1">
            {sells.map((s) => <Card key={s.ticker} s={s} mode="sell" />)}
          </div>
        )}
      </div>
    </div>
  )
}
