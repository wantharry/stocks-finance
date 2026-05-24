import axios from 'axios'
import type {
  MarketIndex,
  PriceBar,
  RecommendationList,
  RefreshStatus,
  SectorSummary,
  StockSummary,
  StocksResponse,
} from '../types'

const api = axios.create({ baseURL: '/api' })

// ── Stocks ───────────────────────────────────────────────────────────────

export interface StocksParams {
  page?: number
  page_size?: number
  sector?: string
  recommendation?: string
  search?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
  min_score?: number
  max_score?: number
}

export const fetchStocks = async (params: StocksParams = {}): Promise<StocksResponse> => {
  const { data } = await api.get<StocksResponse>('/stocks', { params })
  return data
}

export const fetchStockDetail = async (ticker: string): Promise<StockSummary> => {
  const { data } = await api.get<StockSummary>(`/stocks/${ticker}`)
  return data
}

export const fetchStockHistory = async (ticker: string, period = '1y'): Promise<PriceBar[]> => {
  const { data } = await api.get<PriceBar[]>(`/stocks/${ticker}/history`, { params: { period } })
  return data
}

// ── Market ───────────────────────────────────────────────────────────────

export const fetchIndices = async (): Promise<MarketIndex[]> => {
  const { data } = await api.get<MarketIndex[]>('/indices')
  return data
}

export const fetchRecommendations = async (limit = 10): Promise<RecommendationList> => {
  const { data } = await api.get<RecommendationList>('/recommendations', { params: { limit } })
  return data
}

export const fetchSectors = async (): Promise<SectorSummary[]> => {
  const { data } = await api.get<SectorSummary[]>('/sectors')
  return data
}

export const fetchSectorList = async (): Promise<string[]> => {
  const { data } = await api.get<string[]>('/sectors/list')
  return data
}

// ── Refresh ───────────────────────────────────────────────────────────────

export const fetchRefreshStatus = async (): Promise<RefreshStatus> => {
  const { data } = await api.get<RefreshStatus>('/refresh/status')
  return data
}

export const triggerRefresh = async (): Promise<void> => {
  await api.post('/refresh')
}
