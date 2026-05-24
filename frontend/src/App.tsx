import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart2, BookOpen } from 'lucide-react'
import { fetchRefreshStatus } from './api/client'
import Dashboard from './components/Dashboard'
import StockDetail from './components/StockDetail'
import Methodology from './components/Methodology'

type Tab = 'dashboard' | 'methodology'

export default function App() {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  // Poll refresh status while running
  const { data: refreshStatus } = useQuery({
    queryKey: ['refreshStatus'],
    queryFn: fetchRefreshStatus,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3000 : 30000,
  })

  const handleSelectTicker = (t: string) => {
    setSelectedTicker(t)
    setActiveTab('dashboard')
  }

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

      {/* Top navigation tabs */}
      {!selectedTicker && (
        <nav className="border-b border-slate-800 bg-bg-primary sticky top-0 z-40">
          <div className="max-w-[1600px] mx-auto px-4 flex items-center gap-1 h-11">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart2 size={15} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('methodology')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'methodology'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen size={15} />
              How It Works
            </button>
          </div>
        </nav>
      )}

      <div className={refreshStatus?.status === 'running' ? 'pt-2' : ''}>
        {selectedTicker ? (
          <StockDetail ticker={selectedTicker} onBack={() => setSelectedTicker(null)} />
        ) : activeTab === 'methodology' ? (
          <Methodology />
        ) : (
          <Dashboard
            onSelectTicker={handleSelectTicker}
            refreshStatus={refreshStatus}
          />
        )}
      </div>
    </div>
  )
}
