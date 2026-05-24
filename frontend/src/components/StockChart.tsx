import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area,
} from 'recharts'
import { fetchStockHistory } from '../api/client'

type Period = '1w' | '1m' | '3m' | '6m' | '1y'

interface Props {
  ticker: string
}

const PERIODS: { label: string; value: Period }[] = [
  { label: '1W', value: '1w' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {d?.close != null && <p className="text-slate-100">Close: <span className="font-mono text-emerald-300">${d.close.toFixed(2)}</span></p>}
      {d?.open != null && <p className="text-slate-400">Open: <span className="font-mono">${d.open.toFixed(2)}</span></p>}
      {d?.high != null && <p className="text-slate-400">High: <span className="font-mono text-green-400">${d.high.toFixed(2)}</span></p>}
      {d?.low != null && <p className="text-slate-400">Low: <span className="font-mono text-red-400">${d.low.toFixed(2)}</span></p>}
      {d?.volume != null && <p className="text-slate-400 mt-1">Vol: <span className="font-mono">{(d.volume / 1e6).toFixed(2)}M</span></p>}
    </div>
  )
}

const RsiTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
      <p className="text-slate-400">{label}</p>
      <p className="text-yellow-300">RSI: {payload[0]?.value?.toFixed(1)}</p>
    </div>
  )
}

const MacdTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const macd = payload.find((p: any) => p.name === 'macd')?.value
  const signal = payload.find((p: any) => p.name === 'macd_signal')?.value
  const hist = payload.find((p: any) => p.name === 'macd_hist')?.value
  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
      <p className="text-slate-400">{label}</p>
      {macd != null && <p className="text-blue-300">MACD: {macd.toFixed(3)}</p>}
      {signal != null && <p className="text-orange-300">Signal: {signal.toFixed(3)}</p>}
      {hist != null && <p className={hist >= 0 ? 'text-emerald-300' : 'text-red-300'}>Hist: {hist.toFixed(3)}</p>}
    </div>
  )
}

export default function StockChart({ ticker }: Props) {
  const [period, setPeriod] = useState<Period>('3m')

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['history', ticker, period],
    queryFn: () => fetchStockHistory(ticker, period),
  })

  // Determine if price went up over the period
  const priceUp = history.length >= 2
    ? history[history.length - 1].close >= history[0].close
    : true
  const lineColor = priceUp ? '#10b981' : '#ef4444'
  const gradientId = `gradient-${ticker}`

  if (isLoading) return (
    <div className="space-y-4">
      {[200, 120, 120].map((h, i) => (
        <div key={i} className="animate-pulse bg-slate-700/30 rounded-xl" style={{ height: h }} />
      ))}
    </div>
  )

  if (history.length === 0) return (
    <div className="text-center py-12 text-slate-500">No price history available</div>
  )

  // Format dates for display
  const displayData = history.map((bar) => ({
    ...bar,
    label: new Date(bar.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  const closes = history.map((b) => b.close)
  const minClose = Math.min(...closes) * 0.995
  const maxClose = Math.max(...closes) * 1.005

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-accent-blue text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-bg-hover'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Price + Volume chart */}
      <div>
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Price</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={displayData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="price"
              domain={[minClose, maxClose]}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
              width={60}
            />
            <YAxis
              yAxisId="vol"
              orientation="right"
              tick={false}
              axisLine={false}
              width={0}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="vol" dataKey="volume" fill="#334155" opacity={0.5} radius={[1, 1, 0, 0]} />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: lineColor }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* RSI chart */}
      <div>
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">RSI (14)</p>
        <ResponsiveContainer width="100%" height={110}>
          <ComposedChart data={displayData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} width={30} />
            <Tooltip content={<RsiTooltip />} />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.6} />
            <ReferenceLine y={50} stroke="#475569" strokeDasharray="2 6" strokeOpacity={0.4} />
            <Line type="monotone" dataKey="rsi" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MACD chart */}
      <div>
        <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">MACD (12, 26, 9)</p>
        <ResponsiveContainer width="100%" height={110}>
          <ComposedChart data={displayData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} width={40} />
            <Tooltip content={<MacdTooltip />} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar
              dataKey="macd_hist"
              fill="#3b82f6"
              radius={[1, 1, 0, 0]}
              // Color based on value
            />
            <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="macd" />
            <Line type="monotone" dataKey="macd_signal" stroke="#f97316" strokeWidth={1.5} dot={false} name="macd_signal" />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-1 text-xs text-slate-500">
          <span><span className="inline-block w-3 h-0.5 bg-blue-400 mr-1 align-middle" />MACD</span>
          <span><span className="inline-block w-3 h-0.5 bg-orange-400 mr-1 align-middle" />Signal</span>
          <span className="text-slate-600">Green line = Buy zone (RSI &lt; 30) · Red line = Sell zone (RSI &gt; 70)</span>
        </div>
      </div>
    </div>
  )
}
