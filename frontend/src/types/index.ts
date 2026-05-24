export interface StockSummary {
  ticker: string
  name: string | null
  sector: string | null
  industry: string | null
  market_cap: number | null
  current_price: number | null
  price_change: number | null
  price_change_pct: number | null
  volume: number | null
  avg_volume: number | null
  rsi: number | null
  macd: number | null
  macd_signal: number | null
  macd_hist: number | null
  sma_50: number | null
  sma_200: number | null
  bb_upper: number | null
  bb_lower: number | null
  bb_width: number | null
  pe_ratio: number | null
  pb_ratio: number | null
  ps_ratio: number | null
  peg_ratio: number | null
  forward_pe: number | null
  revenue_growth: number | null
  earnings_growth: number | null
  roe: number | null
  debt_equity: number | null
  profit_margin: number | null
  dividend_yield: number | null
  beta: number | null
  week52_high: number | null
  week52_low: number | null
  technical_score: number | null
  fundamental_score: number | null
  overall_score: number | null
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell' | null
  confidence: number | null
  last_analyzed: string | null
  description?: string
}

export interface PriceBar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface MarketIndex {
  symbol: string
  name: string
  price: number | null
  change: number | null
  change_pct: number | null
}

export interface RecommendationList {
  buy: StockSummary[]
  sell: StockSummary[]
}

export interface StocksResponse {
  total: number
  page: number
  page_size: number
  data: StockSummary[]
}

export interface SectorSummary {
  sector: string
  count: number
  avg_score: number | null
  avg_change_pct: number | null
  buy_count: number
  sell_count: number
}

export interface RefreshStatus {
  status: 'idle' | 'running' | 'done' | 'error'
  completed: number
  total: number
  started_at: string | null
}

export type Recommendation = 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'
