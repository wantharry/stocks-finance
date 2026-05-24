import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart2, RefreshCw } from 'lucide-react'
import { triggerRefresh } from '../api/client'
import MarketOverview from './MarketOverview'
import RecommendationPanel from './RecommendationPanel'
import FilterBar, { type Filters } from './FilterBar'
import StockTable from './StockTable'
import type { RefreshStatus } from '../types'

interface Props {
  onSelectTicker: (t: string) => void
  refreshStatus?: RefreshStatus
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  sector: '',
  recommendation: '',
  sort_by: 'overall_score',
  sort_dir: 'desc',
}

export default function Dashboard({ onSelectTicker, refreshStatus }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [refreshing, setRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const handleRefresh = async () => {
    if (refreshing || refreshStatus?.status === 'running') return
    setRefreshing(true)
    try {
      await triggerRefresh()
      await queryClient.invalidateQueries()
    } finally {
      setRefreshing(false)
    }
  }

  const isRunning = refreshStatus?.status === 'running'
  const lastUpdated = refreshStatus?.started_at
    ? new Date(refreshStatus.started_at).toLocaleTimeString()
    : null

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 sm:py-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <BarChart2 size={24} className="text-accent-blue shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-white">StockIQ</h1>
            <p className="text-xs text-slate-500">Market Analysis · Yahoo Finance (free)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && !isRunning && (
            <span className="text-xs text-slate-500 hidden sm:inline">Updated {lastUpdated}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || isRunning}
            className="flex items-center gap-2 px-3 py-2 bg-bg-card border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-bg-hover hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={15} className={isRunning || refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{isRunning ? 'Refreshing…' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* Market Overview */}
      <MarketOverview />

      {/* Top Recommendations */}
      <RecommendationPanel onSelectTicker={onSelectTicker} />

      {/* Stock Screener */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-3">
          Stock Screener
          <span className="text-sm font-normal text-slate-500 ml-2">Top 1,000 US stocks by market cap</span>
        </h2>
        <FilterBar filters={filters} onChange={setFilters} />
        <StockTable filters={filters} onSelectTicker={onSelectTicker} />
      </div>

      {/* Legend */}
      <div className="mt-6 p-4 bg-bg-card rounded-xl border border-slate-700/30 text-xs text-slate-500">
        <p className="font-medium text-slate-400 mb-1">How scores work</p>
        <p>
          <span className="text-emerald-400">Score ≥ 75</span> = Strong Buy ·{' '}
          <span className="text-green-400">60–75</span> = Buy ·{' '}
          <span className="text-yellow-400">45–60</span> = Hold ·{' '}
          <span className="text-orange-400">30–45</span> = Sell ·{' '}
          <span className="text-red-400">&lt; 30</span> = Strong Sell.{' '}
          Composite score = 60% technical (RSI, MACD, Moving Averages, Bollinger Bands) + 40% fundamental (P/E, growth, debt).
          Data is sourced free from Yahoo Finance via yfinance. Delayed ~15 minutes. Not financial advice.
        </p>
      </div>
    </div>
  )
}
