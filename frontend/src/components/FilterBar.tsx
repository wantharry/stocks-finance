import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { fetchSectorList } from '../api/client'

const RECOMMENDATIONS = ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell']

export interface Filters {
  search: string
  sector: string
  recommendation: string
  sort_by: string
  sort_dir: 'asc' | 'desc'
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
}

export default function FilterBar({ filters, onChange }: Props) {
  const { data: sectors = [] } = useQuery({
    queryKey: ['sectors-list'],
    queryFn: fetchSectorList,
    staleTime: Infinity,
  })

  const set = (partial: Partial<Filters>) => onChange({ ...filters, ...partial })

  const sortOptions = [
    { value: 'overall_score', label: 'Score' },
    { value: 'technical_score', label: 'Tech Score' },
    { value: 'fundamental_score', label: 'Fund Score' },
    { value: 'current_price', label: 'Price' },
    { value: 'price_change_pct', label: '% Change' },
    { value: 'market_cap', label: 'Market Cap' },
    { value: 'rsi', label: 'RSI' },
    { value: 'volume', label: 'Volume' },
  ]

  const hasFilters = filters.search || filters.sector || filters.recommendation

  return (
    <div className="bg-bg-card rounded-xl border border-slate-700/50 p-3 sm:p-4 mb-4">
      <div className="flex flex-col gap-2">
        {/* Row 1: Search (full width) */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ticker or company…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            className="w-full bg-bg-primary border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue transition-colors"
          />
          {filters.search && (
            <button onClick={() => set({ search: '' })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Row 2: Dropdowns in a 2×2 grid on mobile, single row on sm+ */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 items-center">
          {/* Sector */}
          <select
            value={filters.sector}
            onChange={(e) => set({ sector: e.target.value })}
            className="w-full bg-bg-primary border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent-blue"
          >
            <option value="">All Sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Recommendation */}
          <select
            value={filters.recommendation}
            onChange={(e) => set({ recommendation: e.target.value })}
            className="w-full bg-bg-primary border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent-blue"
          >
            <option value="">All Signals</option>
            {RECOMMENDATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          {/* Sort */}
          <select
            value={filters.sort_by}
            onChange={(e) => set({ sort_by: e.target.value })}
            className="w-full bg-bg-primary border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-accent-blue"
          >
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Sort dir + clear */}
          <div className="flex gap-2">
            <button
              onClick={() => set({ sort_dir: filters.sort_dir === 'desc' ? 'asc' : 'desc' })}
              className="flex-1 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-bg-hover transition-colors whitespace-nowrap"
            >
              {filters.sort_dir === 'desc' ? '↓ Desc' : '↑ Asc'}
            </button>
            {hasFilters && (
              <button
                onClick={() => onChange({ search: '', sector: '', recommendation: '', sort_by: filters.sort_by, sort_dir: filters.sort_dir })}
                className="border border-slate-700 rounded-lg px-3 py-2 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
                title="Clear filters"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
