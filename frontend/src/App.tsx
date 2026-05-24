import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchRefreshStatus } from './api/client'
import Dashboard from './components/Dashboard'
import StockDetail from './components/StockDetail'

export default function App() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  // Poll refresh status while running
  const { data: refreshStatus } = useQuery({
    queryKey: ['refreshStatus'],
    queryFn: fetchRefreshStatus,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3000 : 30000,
  })

  return (
    <div className="min-h-screen bg-bg-primary text-slate-100">
      {/* Loading banner while initial data fetch is running */}
      {refreshStatus?.status === 'running' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-900/80 text-blue-100 text-sm px-4 py-2 flex items-center justify-between">
          <span>
            Loading market data… {refreshStatus.completed}/{refreshStatus.total} stocks processed
          </span>
          <div className="w-48 h-1.5 bg-blue-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-500"
              style={{
                width: refreshStatus.total
                  ? `${(refreshStatus.completed / refreshStatus.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      )}

      <div className={refreshStatus?.status === 'running' ? 'pt-8' : ''}>
        {selectedTicker ? (
          <StockDetail ticker={selectedTicker} onBack={() => setSelectedTicker(null)} />
        ) : (
          <Dashboard
            onSelectTicker={setSelectedTicker}
            refreshStatus={refreshStatus}
          />
        )}
      </div>
    </div>
  )
}
