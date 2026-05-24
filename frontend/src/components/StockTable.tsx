import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, LayoutList, Table2 } from 'lucide-react'
import { fetchStocks } from '../api/client'
import type { Filters } from './FilterBar'
import {
  changeColor, fmtCurrency, fmtMarketCap, fmtPct, fmtVolume,
  RecBadge, RsiIndicator, ScoreBar,
} from './ui'
import clsx from 'clsx'

interface Props {
  filters: Filters
  onSelectTicker: (t: string) => void
}

const PAGE_SIZE = 50

type SortDir = 'desc' | 'asc'

const COLUMNS: { label: string; key: string | null }[] = [
  { label: 'Ticker',        key: 'ticker' },
  { label: 'Company',       key: 'name' },
  { label: 'Sector',        key: 'sector' },
  { label: 'Price',         key: 'current_price' },
  { label: 'Change %',      key: 'price_change_pct' },
  { label: 'Volume',        key: 'volume' },
  { label: 'Mkt Cap',       key: 'market_cap' },
  { label: 'RSI',           key: 'rsi' },
  { label: 'MACD',          key: null },
  { label: 'MA Status',     key: null },
  { label: 'P/E',           key: 'pe_ratio' },
  { label: 'Tech Score',    key: 'technical_score' },
  { label: 'Overall Score', key: 'overall_score' },
  { label: 'Signal',        key: 'recommendation' },
]

export default function StockTable({ filters, onSelectTicker }: Props) {
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('overall_score')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [mobileView, setMobileView] = useState<'cards' | 'table'>('cards')

  const handleSort = (key: string | null) => {
    if (!key) return
    if (key === sortBy) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  const SortIcon = ({ colKey }: { colKey: string | null }) => {
    if (!colKey) return null
    if (colKey !== sortBy) return <ChevronsUpDown size={12} className="ml-1 text-slate-600" />
    return sortDir === 'desc'
      ? <ChevronDown size={12} className="ml-1 text-accent-blue" />
      : <ChevronUp size={12} className="ml-1 text-accent-blue" />
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stocks', filters, page, sortBy, sortDir],
    queryFn: () =>
      fetchStocks({
        page,
        page_size: PAGE_SIZE,
        search: filters.search || undefined,
        sector: filters.sector || undefined,
        recommendation: filters.recommendation || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
    placeholderData: (prev) => prev,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const maStatus = (s: any) => {
    if (!s.sma_50 || !s.sma_200 || !s.current_price) return null
    if (s.current_price > s.sma_50 && s.sma_50 > s.sma_200) return { label: 'Golden', color: 'text-emerald-400' }
    if (s.current_price < s.sma_50 && s.sma_50 < s.sma_200) return { label: 'Death X', color: 'text-red-400' }
    return { label: 'Mixed', color: 'text-yellow-400' }
  }

  const macdStatus = (s: any) => {
    if (s.macd == null || s.macd_signal == null) return null
    return s.macd > s.macd_signal
      ? { label: '▲ Bull', color: 'text-emerald-400' }
      : { label: '▼ Bear', color: 'text-red-400' }
  }

  if (isError) return (
    <div className="bg-bg-card rounded-xl border border-red-500/30 p-8 text-center text-red-300">
      Failed to load stocks. Make sure the backend is running.
    </div>
  )

  // ── Pagination bar (shared) ──────────────────────────────────────────
  const PaginationBar = () => (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50 text-sm text-slate-400">
      <span>{total.toLocaleString()} stocks</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="p-1 rounded hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-slate-300 text-xs">
          {page} / {totalPages || 1}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="p-1 rounded hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-bg-card rounded-xl border border-slate-700/50 overflow-hidden">

      {/* ── MOBILE SECTION (hidden on md+) ── */}
      <div className="md:hidden">

        {/* Cards / Desktop View tab switcher */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setMobileView('cards')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                mobileView === 'cards'
                  ? 'bg-bg-card text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <LayoutList size={13} /> Cards
            </button>
            <button
              onClick={() => setMobileView('table')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                mobileView === 'table'
                  ? 'bg-bg-card text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Table2 size={13} /> Desktop View
            </button>
          </div>
          <span className="text-xs text-slate-500">{total.toLocaleString()} stocks</span>
        </div>

        {/* ── CARDS VIEW ── */}
        {mobileView === 'cards' && (<>
        {/* Quick sort pills */}
        <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-slate-700/50 scrollbar-hide">
          {[
            { label: 'Score',    key: 'overall_score' },
            { label: 'Tech',     key: 'technical_score' },
            { label: 'Price',    key: 'current_price' },
            { label: 'Change%',  key: 'price_change_pct' },
            { label: 'Mkt Cap',  key: 'market_cap' },
            { label: 'RSI',      key: 'rsi' },
            { label: 'P/E',      key: 'pe_ratio' },
            { label: 'Volume',   key: 'volume' },
          ].map(({ label, key }) => {
            const active = sortBy === key
            return (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className={clsx(
                  'shrink-0 flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  active
                    ? 'bg-accent-blue text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                )}
              >
                {label}
                {active && (sortDir === 'desc'
                  ? <ChevronDown size={11} />
                  : <ChevronUp size={11} />)}
              </button>
            )
          })}
        </div>
        {isLoading && rows.length === 0 ? (
          <div className="divide-y divide-slate-700/30">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
                <div className="h-5 w-14 bg-slate-700/50 rounded" />
                <div className="flex-1 h-4 bg-slate-700/50 rounded" />
                <div className="h-5 w-16 bg-slate-700/50 rounded" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-slate-500 text-sm">No stocks match your filters.</p>
        ) : (
          <div className="divide-y divide-slate-700/30">
            {rows.map((s) => {
              const mc = macdStatus(s)
              return (
                <button
                  key={s.ticker}
                  onClick={() => onSelectTicker(s.ticker)}
                  className="w-full text-left px-4 py-3.5 hover:bg-bg-hover active:bg-bg-hover transition-colors flex items-center gap-3"
                >
                  {/* Ticker + name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-accent-blue text-sm">{s.ticker}</span>
                      <RecBadge rec={s.recommendation} />
                    </div>
                    <p className="text-xs text-slate-400 truncate">{s.name ?? '—'}</p>
                  </div>

                  {/* Price + change */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono text-slate-200">{fmtCurrency(s.current_price)}</p>
                    <p className={clsx('text-xs font-mono', changeColor(s.price_change_pct))}>
                      {fmtPct(s.price_change_pct)}
                    </p>
                  </div>

                  {/* Score bar */}
                  <div className="w-16 shrink-0">
                    <ScoreBar score={s.overall_score} />
                  </div>

                  <ChevronRight size={14} className="text-slate-600 shrink-0" />
                </button>
              )
            })}
          </div>
        )}
        <PaginationBar />
        </>)}

        {/* ── DESKTOP TABLE VIEW (inside mobile, horizontally scrollable) ── */}
        {mobileView === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-primary border-b border-slate-700/50">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      onClick={() => handleSort(col.key)}
                      className={clsx(
                        'text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap select-none',
                        col.key ? 'cursor-pointer hover:text-slate-200 transition-colors' : '',
                        col.key === sortBy ? 'text-accent-blue' : '',
                      )}
                    >
                      <span className="inline-flex items-center">
                        {col.label}
                        <SortIcon colKey={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {isLoading && rows.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 14 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-700/50 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center py-10 text-slate-500 text-sm">
                      No stocks match your filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((s) => {
                    const ma = maStatus(s)
                    const mc = macdStatus(s)
                    return (
                      <tr
                        key={s.ticker}
                        className="hover:bg-bg-hover active:bg-bg-hover cursor-pointer transition-colors group"
                        onClick={() => onSelectTicker(s.ticker)}
                      >
                        <td className="px-4 py-3 font-bold text-accent-blue group-hover:text-blue-300 whitespace-nowrap">{s.ticker}</td>
                        <td className="px-4 py-3 text-slate-300 max-w-[150px] truncate">{s.name ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{s.sector ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">{fmtCurrency(s.current_price)}</td>
                        <td className={clsx('px-4 py-3 font-mono whitespace-nowrap', changeColor(s.price_change_pct))}>{fmtPct(s.price_change_pct)}</td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtVolume(s.volume)}</td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtMarketCap(s.market_cap)}</td>
                        <td className="px-4 py-3"><RsiIndicator rsi={s.rsi} /></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {mc ? <span className={clsx('text-xs font-medium', mc.color)}>{mc.label}</span> : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {ma ? <span className={clsx('text-xs font-medium', ma.color)}>{ma.label}</span> : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">{s.pe_ratio != null ? s.pe_ratio.toFixed(1) : '—'}</td>
                        <td className="px-4 py-3 w-28"><ScoreBar score={s.technical_score} /></td>
                        <td className="px-4 py-3 w-28"><ScoreBar score={s.overall_score} /></td>
                        <td className="px-4 py-3 whitespace-nowrap"><RecBadge rec={s.recommendation} /></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
            <PaginationBar />
          </div>
        )}

      </div>{/* end mobile section */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-primary border-b border-slate-700/50">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.label}
                  onClick={() => handleSort(col.key)}
                  className={clsx(
                    'text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap select-none',
                    col.key ? 'cursor-pointer hover:text-slate-200 transition-colors' : '',
                    col.key === sortBy ? 'text-accent-blue' : '',
                  )}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    <SortIcon colKey={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {isLoading && rows.length === 0 ? (
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 14 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-slate-700/50 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={14} className="text-center py-12 text-slate-500">
                  No stocks match your filters. Data may still be loading.
                </td>
              </tr>
            ) : (
              rows.map((s) => {
                const ma = maStatus(s)
                const mc = macdStatus(s)
                return (
                  <tr
                    key={s.ticker}
                    className="hover:bg-bg-hover cursor-pointer transition-colors group"
                    onClick={() => onSelectTicker(s.ticker)}
                  >
                    <td className="px-4 py-3 font-bold text-accent-blue group-hover:text-blue-300 whitespace-nowrap">
                      {s.ticker}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-[150px] truncate" title={s.name ?? ''}>
                      {s.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                      {s.sector ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">
                      {fmtCurrency(s.current_price)}
                    </td>
                    <td className={clsx('px-4 py-3 font-mono whitespace-nowrap', changeColor(s.price_change_pct))}>
                      {fmtPct(s.price_change_pct)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {fmtVolume(s.volume)}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {fmtMarketCap(s.market_cap)}
                    </td>
                    <td className="px-4 py-3">
                      <RsiIndicator rsi={s.rsi} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {mc ? (
                        <span className={clsx('text-xs font-medium', mc.color)}>{mc.label}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ma ? (
                        <span className={clsx('text-xs font-medium', ma.color)}>{ma.label}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                      {s.pe_ratio != null ? s.pe_ratio.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 w-28">
                      <ScoreBar score={s.technical_score} />
                    </td>
                    <td className="px-4 py-3 w-28">
                      <ScoreBar score={s.overall_score} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <RecBadge rec={s.recommendation} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        <PaginationBar />
      </div>

    </div>
  )
}
