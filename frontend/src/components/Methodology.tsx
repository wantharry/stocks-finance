/**
 * Methodology page — transparent explanation of every scoring rule,
 * weight, data source, and refresh cycle used by StockIQ.
 */
export default function Methodology() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10 text-slate-300">

      {/* ── Title ── */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">How StockIQ Works</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Every number on this platform is deterministic and rule-based. Nothing is predicted by AI or a black box.
          This page documents every scoring rule so you can verify, agree, or disagree before acting.
          <span className="text-yellow-400 font-medium"> This is not financial advice.</span>
        </p>
      </div>

      {/* ── Data Sources ── */}
      <Section title="1. Data Sources">
        <Row label="Price / OHLCV history" value="Yahoo Finance via yfinance (free, unofficial API)" />
        <Row label="Fundamental data" value="Yahoo Finance info endpoint (P/E, growth, debt, market cap, etc.)" />
        <Row label="Stock universe" value="Wikipedia tables: S&P 500 + NASDAQ-100 + Dow 30 → ~582 unique US tickers" />
        <Row label="Market indices" value="^GSPC (S&P 500), ^IXIC (NASDAQ), ^DJI (Dow Jones), ^RUT (Russell 2000), ^VIX" />
        <Row label="Data delay" value="~15 minutes (Yahoo Finance free tier)" />
        <Row label="Price history" value="1 year of daily OHLCV (Open, High, Low, Close, Volume)" />
        <Note>
          Data is entirely free. Yahoo Finance may throttle or temporarily block requests; yfinance handles
          authentication automatically using session cookies.
        </Note>
      </Section>

      {/* ── Refresh Cycle ── */}
      <Section title="2. Refresh Cycle">
        <p className="text-sm leading-relaxed mb-4">
          A refresh is triggered on first startup and again whenever you click <strong className="text-white">Refresh Data</strong>.
          It runs in two sequential phases:
        </p>
        <div className="space-y-4">
          <PhaseCard
            phase="Phase 1 — Price Download (fast, ~2-5 min)"
            color="blue"
            steps={[
              'Fetch ~582 tickers from Wikipedia (cached per run).',
              'Download 1-year daily OHLCV in batches of 100 tickers using yf.download().',
              'For each ticker immediately: compute technical indicators, score, and write to SQLite.',
              'Progress bar in the UI updates after every batch.',
            ]}
          />
          <PhaseCard
            phase="Phase 2 — Fundamental Enrichment (slow, background daemon)"
            color="purple"
            steps={[
              'Runs concurrently in a background thread after Phase 1 starts.',
              'Fetches per-ticker fundamental info (P/E, revenue growth, debt/equity, etc.) one-by-one.',
              '2-second delay between each ticker to avoid Yahoo Finance rate limiting.',
              'Updates the composite score in-place — scores improve as fundamentals arrive.',
              'Full run takes ~20-30 minutes for all 582 tickers.',
            ]}
          />
        </div>
        <Note>
          Because Phase 1 writes data immediately, you can start browsing within minutes even before
          all fundamentals are loaded. Tickers without fundamentals yet use 100% technical scoring.
        </Note>
      </Section>

      {/* ── Storage ── */}
      <Section title="3. Storage (SQLite)">
        <p className="text-sm mb-4">All data is persisted in <code className="text-accent-blue">stockiq.db</code> (local SQLite file). Five tables:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left py-2 pr-6">Table</th>
                <th className="text-left py-2">Contents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[
                ['stocks', 'Static metadata: ticker, name, sector, industry, country, market cap, employee count, description'],
                ['stock_prices', 'Daily OHLCV rows (date, open, high, low, close, volume, adj_close). ~365 rows per ticker.'],
                ['stock_analysis', 'Latest computed indicators + scores: RSI, MACD, SMAs, Bollinger Bands, P/E, debt/equity, overall_score, recommendation, …'],
                ['market_indices', 'Latest price/change for the 5 index symbols (^GSPC, ^IXIC, ^DJI, ^RUT, ^VIX)'],
                ['refresh_status', 'Single-row status of the current or last refresh (running/completed, completed count, total)'],
              ].map(([t, d]) => (
                <tr key={t}>
                  <td className="py-2 pr-6 font-mono text-accent-blue whitespace-nowrap">{t}</td>
                  <td className="py-2 text-slate-400">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Composite Score ── */}
      <Section title="4. Composite Score (0 – 100)">
        <p className="text-sm leading-relaxed mb-5">
          Every stock gets a single <strong className="text-white">Overall Score</strong> from 0 to 100 built from two pillars:
        </p>

        <div className="flex gap-4 mb-6 flex-wrap">
          <ScorePillar pct={60} label="Technical Score" color="blue" />
          <ScorePillar pct={40} label="Fundamental Score" color="emerald" />
        </div>

        <Note>
          If no fundamental data is available (Phase 2 hasn't run yet or Yahoo returned nothing), the
          composite falls back to <strong className="text-white">100% technical</strong> so every ticker
          always has a score.
        </Note>

        <FormulaBox>
          Overall Score = (Technical Score × 0.60) + (Fundamental Score × 0.40)
        </FormulaBox>
      </Section>

      {/* ── Technical Score ── */}
      <Section title="5. Technical Score Breakdown (60% of Overall)">
        <p className="text-sm mb-5">
          The technical score combines four indicators, each independently scored 0–100, then weighted:
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <WeightCard label="RSI" weight={25} />
          <WeightCard label="MACD" weight={30} />
          <WeightCard label="Moving Averages" weight={25} />
          <WeightCard label="Bollinger Bands" weight={20} />
        </div>

        <FormulaBox>
          Technical Score = (RSI_score × 0.25) + (MACD_score × 0.30) + (MA_score × 0.25) + (BB_score × 0.20)
        </FormulaBox>

        {/* RSI */}
        <Indicator title="RSI — Relative Strength Index (14-day)" color="blue">
          <p className="text-xs text-slate-400 mb-3">
            Measures momentum. Values above 70 = overbought (sell pressure). Values below 30 = oversold (buy pressure).
            Computed with Wilder's smoothed exponential moving average on 14 daily closes.
          </p>
          <ScoreTable rows={[
            ['≤ 20', '100', 'Extremely oversold — strong buy signal'],
            ['21–30', '85', 'Oversold — buy signal'],
            ['31–40', '70', 'Approaching oversold'],
            ['41–50', '57', 'Neutral-bullish'],
            ['51–60', '45', 'Neutral-bearish'],
            ['61–70', '30', 'Approaching overbought'],
            ['71–80', '15', 'Overbought — sell signal'],
            ['> 80', '5', 'Extremely overbought — strong sell signal'],
          ]} headers={['RSI Value', 'Score', 'Interpretation']} />
        </Indicator>

        {/* MACD */}
        <Indicator title="MACD — Moving Average Convergence/Divergence" color="blue">
          <p className="text-xs text-slate-400 mb-3">
            Tracks trend momentum via two EMAs. <strong className="text-white">MACD Line</strong> = EMA(12) − EMA(26).
            <strong className="text-white"> Signal Line</strong> = EMA(9) of MACD. Histogram = MACD − Signal.
          </p>
          <ScoreTable rows={[
            ['MACD > 0  AND  histogram > 0', '85', 'Above zero, bullish crossover (momentum accelerating up)'],
            ['MACD > 0  AND  histogram ≤ 0', '55', 'Above zero but bearish crossover (slowing, still positive)'],
            ['MACD ≤ 0  AND  histogram > 0', '45', 'Below zero, bullish reversal (momentum turning up)'],
            ['MACD ≤ 0  AND  histogram ≤ 0', '20', 'Below zero, bearish (downward momentum)'],
          ]} headers={['Condition', 'Score', 'Interpretation']} />
        </Indicator>

        {/* Moving Averages */}
        <Indicator title="Moving Averages — SMA-50 and SMA-200" color="blue">
          <p className="text-xs text-slate-400 mb-3">
            Simple moving averages detect trend direction. The <strong className="text-white">Golden Cross</strong> (SMA-50 crossing above SMA-200)
            is one of the most-watched long-term bullish signals. The opposite is the <strong className="text-white">Death Cross</strong>.
          </p>
          <ScoreTable rows={[
            ['Price > SMA-50 > SMA-200', '90', 'Strong uptrend (Golden Cross active, price above both MAs)'],
            ['Price > SMA-50, SMA-50 ≤ SMA-200', '60', 'Recovering — price above short MA but long MA lagging'],
            ['Price ≤ SMA-50, SMA-50 > SMA-200', '40', 'Weakening — price below short MA, still above long trend'],
            ['Price < SMA-50 < SMA-200', '10', 'Strong downtrend (Death Cross active)'],
            ['Only SMA-50 available, price above', '70', 'Moderate uptrend (insufficient history for SMA-200)'],
            ['Only SMA-50 available, price below', '30', 'Moderate downtrend'],
          ]} headers={['Condition', 'Score', 'Interpretation']} />
        </Indicator>

        {/* Bollinger Bands */}
        <Indicator title="Bollinger Bands (20-day SMA ± 2 std dev)" color="blue">
          <p className="text-xs text-slate-400 mb-3">
            Bands expand during volatility and contract during calm. Price near the lower band = oversold.
            Price near the upper band = overbought. Position = (price − lower) / (upper − lower).
          </p>
          <ScoreTable rows={[
            ['Position ≤ 0  (at or below lower band)', '95', 'Strongly oversold'],
            ['0.01–0.15', '80', 'Near lower band — oversold'],
            ['0.16–0.35', '65', 'Lower half — mild buy bias'],
            ['0.36–0.65', '50', 'Mid-band — neutral'],
            ['0.66–0.85', '35', 'Upper half — mild sell bias'],
            ['0.86–1.00', '20', 'Near upper band — overbought'],
            ['> 1.00  (above upper band)', '5', 'Strongly overbought'],
          ]} headers={['Band Position', 'Score', 'Interpretation']} />
        </Indicator>
      </Section>

      {/* ── Fundamental Score ── */}
      <Section title="6. Fundamental Score Breakdown (40% of Overall)">
        <p className="text-sm mb-5">
          Three financial health factors, each scored 0–100, combined as:
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <WeightCard label="P/E Ratio" weight={35} />
          <WeightCard label="Revenue + EPS Growth" weight={40} />
          <WeightCard label="Debt/Equity" weight={25} />
        </div>

        <FormulaBox>
          Fundamental Score = (PE_score × 0.35) + (Growth_score × 0.40) + (Debt_score × 0.25)
        </FormulaBox>

        <Indicator title="P/E Ratio — Price-to-Earnings" color="emerald">
          <p className="text-xs text-slate-400 mb-3">
            How much investors pay per $1 of earnings. Lower = cheaper relative to earnings. Negative P/E means
            the company is currently losing money.
          </p>
          <ScoreTable rows={[
            ['< 0 (negative earnings)', '10', 'Company losing money'],
            ['0–10', '90', 'Very cheap valuation'],
            ['10–20', '75', 'Reasonably valued'],
            ['20–30', '60', 'Fair — typical for growth stocks'],
            ['30–50', '40', 'Elevated valuation'],
            ['50–100', '25', 'Expensive'],
            ['> 100', '10', 'Extremely expensive or speculative'],
          ]} headers={['P/E Range', 'Score', 'Interpretation']} />
        </Indicator>

        <Indicator title="Growth Score — Revenue & EPS Growth (YoY)" color="emerald">
          <p className="text-xs text-slate-400 mb-3">
            Uses year-over-year revenue growth and EPS growth from Yahoo Finance. Each is scored individually
            then averaged. Growth is provided as a decimal (0.15 = 15%).
          </p>
          <ScoreTable rows={[
            ['> 40%', '95', 'Exceptional growth'],
            ['25–40%', '85', 'Very strong growth'],
            ['15–25%', '72', 'Strong growth'],
            ['5–15%', '60', 'Moderate growth'],
            ['0–5%', '47', 'Slow growth'],
            ['−10–0%', '35', 'Slight decline'],
            ['< −10%', '15', 'Significant decline'],
          ]} headers={['Growth Rate', 'Score', 'Interpretation']} />
          <p className="text-xs text-slate-500 mt-2">
            If only one metric (revenue or EPS) is available, only that one is used. If neither is available, defaults to 50.
          </p>
        </Indicator>

        <Indicator title="Debt/Equity Ratio" color="emerald">
          <p className="text-xs text-slate-400 mb-3">
            Total debt divided by shareholders' equity. Lower = less leverage = less financial risk.
            Very high D/E means the company is heavily financed by debt, increasing bankruptcy risk.
          </p>
          <ScoreTable rows={[
            ['< 0 (negative equity)', '15', 'Negative book value — risky'],
            ['0–0.3', '90', 'Very low leverage'],
            ['0.3–0.6', '75', 'Conservative leverage'],
            ['0.6–1.0', '60', 'Moderate leverage'],
            ['1.0–1.5', '45', 'Above-average leverage'],
            ['1.5–2.5', '30', 'High leverage'],
            ['> 2.5', '15', 'Very high leverage — elevated risk'],
          ]} headers={['D/E Ratio', 'Score', 'Interpretation']} />
        </Indicator>
      </Section>

      {/* ── Recommendation Thresholds ── */}
      <Section title="7. Recommendation Thresholds">
        <p className="text-sm mb-5">
          The Overall Score (0–100) maps to one of five recommendations:
        </p>
        <div className="space-y-2">
          {[
            { label: 'Strong Buy', range: '≥ 75', color: 'emerald', bar: 100, desc: 'Both technical momentum and fundamental quality are strong. Multiple indicators align bullishly.' },
            { label: 'Buy', range: '60 – 74', color: 'green', bar: 75, desc: 'More signals are bullish than bearish. Good risk/reward, but not all indicators confirm.' },
            { label: 'Hold', range: '45 – 59', color: 'yellow', bar: 50, desc: 'Mixed signals. Technicals and fundamentals roughly balanced. No clear edge either way.' },
            { label: 'Sell', range: '30 – 44', color: 'orange', bar: 30, desc: 'More signals are bearish. Consider reducing position or avoiding entry.' },
            { label: 'Strong Sell', range: '< 30', color: 'red', bar: 15, desc: 'Both technical and fundamental signals are negative. High probability of continued decline.' },
          ].map(({ label, range, color, bar, desc }) => (
            <div key={label} className="flex items-start gap-4 p-3 bg-bg-card rounded-lg border border-slate-700/40">
              <div className="w-28 shrink-0">
                <span className={`font-semibold text-${color}-400`}>{label}</span>
                <div className="text-xs text-slate-500">{range}</div>
              </div>
              <div className="flex-1">
                <div className="h-1.5 bg-slate-800 rounded-full mb-2">
                  <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${bar}%` }} />
                </div>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Confidence ── */}
      <Section title="8. Confidence Level">
        <p className="text-sm leading-relaxed mb-3">
          Alongside every recommendation, a <strong className="text-white">Confidence</strong> label (High / Medium / Low) indicates
          how many of the four technical indicators agree with the final signal:
        </p>
        <div className="space-y-2">
          {[
            ['High', 'text-emerald-400', '≥ 3 of 4 technical indicators point the same direction as the overall score'],
            ['Medium', 'text-yellow-400', '2 of 4 indicators agree'],
            ['Low', 'text-red-400', '≤ 1 indicator agrees — contradictory signals, extra caution advised'],
          ].map(([c, cls, d]) => (
            <div key={c} className="flex items-start gap-3 text-sm">
              <span className={`font-semibold w-16 shrink-0 ${cls}`}>{c}</span>
              <span className="text-slate-400">{d}</span>
            </div>
          ))}
        </div>
        <Note>
          Low confidence does not mean "don't buy/sell" — it means the evidence is mixed and you should
          do additional research before acting.
        </Note>
      </Section>

      {/* ── What we don't factor in ── */}
      <Section title="9. What Is NOT Included">
        <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
          <li>News sentiment, earnings call transcripts, or insider trading data</li>
          <li>Analyst price targets or Wall Street ratings</li>
          <li>Options flow, short interest, or institutional ownership changes</li>
          <li>Macroeconomic indicators (interest rates, CPI, GDP)</li>
          <li>Sector rotation or correlation analysis</li>
          <li>After-hours or pre-market price movement</li>
          <li>Dividend history beyond the current yield</li>
        </ul>
        <Note>
          Adding any of the above would improve signal quality. This platform intentionally uses only
          free, publicly-available data to remain accessible to everyone.
        </Note>
      </Section>

      {/* ── Disclaimer ── */}
      <div className="p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-xl text-xs text-yellow-200/70 leading-relaxed">
        <strong className="text-yellow-300">Disclaimer:</strong> StockIQ is a personal research tool, not a registered investment advisor.
        All scores and recommendations are the output of a deterministic rule-based model and do not constitute financial advice.
        Past performance of any signal or indicator is not indicative of future results.
        Always consult a qualified financial professional before making investment decisions.
        Data is sourced from Yahoo Finance free tier and may be delayed up to 15 minutes or contain inaccuracies.
      </div>

    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-white border-b border-slate-700 pb-2 mb-5">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 text-sm py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 w-48 shrink-0">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 px-4 py-3 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs text-blue-200/70 leading-relaxed">
      <strong className="text-blue-300">Note:</strong> {children}
    </div>
  )
}

function FormulaBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 px-5 py-3 bg-slate-800 border border-slate-600 rounded-lg font-mono text-sm text-accent-blue text-center">
      {children}
    </div>
  )
}

function ScorePillar({ pct, label, color }: { pct: number; label: string; color: string }) {
  return (
    <div className={`flex-1 min-w-[140px] p-4 rounded-xl bg-${color}-900/20 border border-${color}-700/40 text-center`}>
      <div className={`text-4xl font-bold text-${color}-400`}>{pct}%</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  )
}

function WeightCard({ label, weight }: { label: string; weight: number }) {
  return (
    <div className="p-3 rounded-lg bg-bg-card border border-slate-700 text-center">
      <div className="text-2xl font-bold text-white">{weight}%</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
      <div className="h-1 bg-slate-700 rounded-full mt-2">
        <div className="h-full bg-accent-blue rounded-full" style={{ width: `${weight}%` }} />
      </div>
    </div>
  )
}

function PhaseCard({ phase, color, steps }: { phase: string; color: string; steps: string[] }) {
  return (
    <div className={`p-4 rounded-xl bg-${color}-900/20 border border-${color}-700/40`}>
      <h4 className={`font-semibold text-${color}-300 text-sm mb-3`}>{phase}</h4>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
            <span className={`text-${color}-400 font-bold shrink-0`}>{i + 1}.</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  )
}

function Indicator({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`mt-6 p-4 rounded-xl bg-${color}-900/10 border border-${color}-800/30`}>
      <h4 className={`font-semibold text-${color}-300 text-sm mb-3`}>{title}</h4>
      {children}
    </div>
  )
}

function ScoreTable({ rows, headers }: { rows: string[][]; headers: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            {headers.map(h => <th key={h} className="text-left py-1.5 pr-4">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map(([cond, score, interp]) => (
            <tr key={cond}>
              <td className="py-1.5 pr-4 font-mono text-slate-300 whitespace-nowrap">{cond}</td>
              <td className="py-1.5 pr-4 font-bold text-white">{score}</td>
              <td className="py-1.5 text-slate-400">{interp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
