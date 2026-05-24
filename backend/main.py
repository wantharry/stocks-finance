"""
StockIQ — FastAPI backend
Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from data.database import (
    engine,
    init_db,
    market_indices,
    now_iso,
    refresh_status,
    stock_analysis,
    stocks,
    stock_prices,
)
from data.fetcher import fetch_market_indices, run_full_refresh
from data.stock_list import get_top_stocks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Shared refresh state ────────────────────────────────────────────────
_refresh_lock = threading.Lock()
_refresh_state: dict = {"status": "idle", "completed": 0, "total": 0, "started_at": None}


def _do_refresh(tickers: list[str]) -> None:
    global _refresh_state
    _refresh_state = {"status": "running", "completed": 0, "total": len(tickers), "started_at": now_iso()}

    with engine.begin() as conn:
        conn.execute(
            refresh_status.insert().values(
                started_at=_refresh_state["started_at"],
                total=len(tickers),
                completed=0,
                status="running",
                message="",
            )
        )

    def on_progress(done: int, total: int) -> None:
        _refresh_state["completed"] = done

    try:
        success, total = run_full_refresh(tickers, on_progress=on_progress)
        _refresh_state["status"] = "done"
        msg = f"{success}/{total} tickers refreshed"
    except Exception as e:
        _refresh_state["status"] = "error"
        msg = str(e)
        logger.error(f"Refresh failed: {e}")

    with engine.begin() as conn:
        conn.execute(
            text("UPDATE refresh_status SET finished_at=:t, completed=:c, status=:s, message=:m WHERE id=(SELECT MAX(id) FROM refresh_status)"),
            {"t": now_iso(), "c": _refresh_state["completed"], "s": _refresh_state["status"], "m": msg},
        )

    # Also update market indices
    try:
        index_rows = fetch_market_indices()
        with engine.begin() as conn:
            for row in index_rows:
                conn.execute(
                    text("""
                        INSERT INTO market_indices (symbol, name, price, change, change_pct, last_updated)
                        VALUES (:symbol, :name, :price, :change, :change_pct, :last_updated)
                        ON CONFLICT(symbol) DO UPDATE SET
                            price=excluded.price, change=excluded.change,
                            change_pct=excluded.change_pct, last_updated=excluded.last_updated
                    """),
                    row,
                )
    except Exception as e:
        logger.warning(f"Index refresh failed: {e}")


# ── Startup ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Kick off initial data refresh in background thread
    tickers = get_top_stocks(limit=1000)
    thread = threading.Thread(target=_do_refresh, args=(tickers,), daemon=True)
    thread.start()
    yield


app = FastAPI(title="StockIQ API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Refresh ───────────────────────────────────────────────────────────────

@app.get("/api/refresh/status")
def get_refresh_status():
    return _refresh_state


@app.post("/api/refresh")
def trigger_refresh(background_tasks: BackgroundTasks):
    if _refresh_state.get("status") == "running":
        return {"message": "Refresh already running", "state": _refresh_state}
    tickers = get_top_stocks(limit=1000)
    thread = threading.Thread(target=_do_refresh, args=(tickers,), daemon=True)
    thread.start()
    return {"message": "Refresh started", "tickers": len(tickers)}


# ── Market Indices ────────────────────────────────────────────────────────

@app.get("/api/indices")
def get_indices():
    with engine.connect() as conn:
        rows = conn.execute(select(market_indices)).mappings().all()
    return [dict(r) for r in rows]


# ── Stocks list ────────────────────────────────────────────────────────────

@app.get("/api/stocks")
def get_stocks(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sector: Optional[str] = None,
    recommendation: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "overall_score",
    sort_dir: str = "desc",
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
):
    allowed_sort = {
        "ticker", "name", "sector", "market_cap", "current_price",
        "price_change_pct", "rsi", "overall_score", "technical_score",
        "fundamental_score", "recommendation", "pe_ratio", "volume",
    }
    if sort_by not in allowed_sort:
        sort_by = "overall_score"
    sort_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"

    conditions = ["1=1"]
    params: dict = {}

    if sector:
        conditions.append("s.sector = :sector")
        params["sector"] = sector
    if recommendation:
        conditions.append("a.recommendation = :rec")
        params["rec"] = recommendation
    if search:
        conditions.append("(a.ticker LIKE :search OR s.name LIKE :search)")
        params["search"] = f"%{search}%"
    if min_score is not None:
        conditions.append("a.overall_score >= :min_score")
        params["min_score"] = min_score
    if max_score is not None:
        conditions.append("a.overall_score <= :max_score")
        params["max_score"] = max_score

    where = " AND ".join(conditions)

    # Determine sort column table prefix
    stock_cols = {"ticker", "name", "sector", "market_cap"}
    prefix = "s" if sort_by in stock_cols else "a"

    count_sql = text(f"""
        SELECT COUNT(*) FROM stock_analysis a
        LEFT JOIN stocks s ON a.ticker = s.ticker
        WHERE {where}
    """)
    data_sql = text(f"""
        SELECT
            a.ticker, s.name, s.sector, s.industry, s.market_cap,
            a.current_price, a.price_change, a.price_change_pct,
            a.volume, a.avg_volume,
            a.rsi, a.macd, a.macd_signal, a.macd_hist,
            a.sma_50, a.sma_200, a.bb_upper, a.bb_lower, a.bb_width,
            a.pe_ratio, a.forward_pe, a.pb_ratio, a.revenue_growth,
            a.earnings_growth, a.roe, a.debt_equity, a.profit_margin,
            a.dividend_yield, a.beta,
            a.week52_high, a.week52_low,
            a.technical_score, a.fundamental_score, a.overall_score,
            a.recommendation, a.confidence, a.last_analyzed
        FROM stock_analysis a
        LEFT JOIN stocks s ON a.ticker = s.ticker
        WHERE {where}
        ORDER BY {prefix}.{sort_by} {sort_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """)

    offset = (page - 1) * page_size
    params["limit"] = page_size
    params["offset"] = offset

    with engine.connect() as conn:
        total = conn.execute(count_sql, params).scalar()
        rows = conn.execute(data_sql, params).mappings().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [dict(r) for r in rows],
    }


# ── Stock detail ──────────────────────────────────────────────────────────

@app.get("/api/stocks/{ticker}")
def get_stock_detail(ticker: str):
    ticker = ticker.upper()
    with engine.connect() as conn:
        stock_row = conn.execute(
            select(stocks).where(stocks.c.ticker == ticker)
        ).mappings().first()
        analysis_row = conn.execute(
            select(stock_analysis).where(stock_analysis.c.ticker == ticker)
        ).mappings().first()

    if not analysis_row:
        raise HTTPException(status_code=404, detail=f"No data for {ticker}. Data may still be loading.")

    result = {}
    if stock_row:
        result.update(dict(stock_row))
    result.update(dict(analysis_row))
    return result


@app.get("/api/stocks/{ticker}/history")
def get_stock_history(ticker: str, period: str = "1y"):
    ticker = ticker.upper()

    period_days = {
        "1w": 7, "1m": 30, "3m": 90, "6m": 180, "1y": 365, "all": 99999,
    }
    days = period_days.get(period, 365)

    sql = text("""
        SELECT date, open, high, low, close, volume
        FROM stock_prices
        WHERE ticker = :ticker
          AND date >= date('now', :offset)
        ORDER BY date ASC
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql, {"ticker": ticker, "offset": f"-{days} days"}).mappings().all()

    if not rows:
        raise HTTPException(status_code=404, detail=f"No price history for {ticker}")

    return [dict(r) for r in rows]


# ── Recommendations ────────────────────────────────────────────────────────

@app.get("/api/recommendations")
def get_recommendations(limit: int = Query(10, ge=1, le=50)):
    sql = text("""
        SELECT a.ticker, s.name, s.sector, a.current_price, a.price_change_pct,
               a.overall_score, a.technical_score, a.fundamental_score,
               a.recommendation, a.confidence, a.rsi, a.macd, a.macd_signal
        FROM stock_analysis a
        LEFT JOIN stocks s ON a.ticker = s.ticker
        WHERE a.recommendation IN ('Strong Buy', 'Buy')
          AND a.overall_score IS NOT NULL
        ORDER BY a.overall_score DESC
        LIMIT :limit
    """)
    sell_sql = text("""
        SELECT a.ticker, s.name, s.sector, a.current_price, a.price_change_pct,
               a.overall_score, a.technical_score, a.fundamental_score,
               a.recommendation, a.confidence, a.rsi, a.macd, a.macd_signal
        FROM stock_analysis a
        LEFT JOIN stocks s ON a.ticker = s.ticker
        WHERE a.recommendation IN ('Strong Sell', 'Sell')
          AND a.overall_score IS NOT NULL
        ORDER BY a.overall_score ASC
        LIMIT :limit
    """)

    with engine.connect() as conn:
        buys = [dict(r) for r in conn.execute(sql, {"limit": limit}).mappings().all()]
        sells = [dict(r) for r in conn.execute(sell_sql, {"limit": limit}).mappings().all()]

    return {"buy": buys, "sell": sells}


# ── Sectors ───────────────────────────────────────────────────────────────

@app.get("/api/sectors")
def get_sectors():
    sql = text("""
        SELECT s.sector,
               COUNT(*) as count,
               AVG(a.overall_score) as avg_score,
               AVG(a.price_change_pct) as avg_change_pct,
               SUM(CASE WHEN a.recommendation IN ('Strong Buy','Buy') THEN 1 ELSE 0 END) as buy_count,
               SUM(CASE WHEN a.recommendation IN ('Strong Sell','Sell') THEN 1 ELSE 0 END) as sell_count
        FROM stock_analysis a
        JOIN stocks s ON a.ticker = s.ticker
        WHERE s.sector IS NOT NULL AND s.sector != 'Unknown'
        GROUP BY s.sector
        ORDER BY avg_score DESC NULLS LAST
    """)
    with engine.connect() as conn:
        rows = conn.execute(sql).mappings().all()
    return [dict(r) for r in rows]


# ── Sector list for filter ────────────────────────────────────────────────

@app.get("/api/sectors/list")
def list_sectors():
    sql = text("SELECT DISTINCT sector FROM stocks WHERE sector IS NOT NULL AND sector != 'Unknown' ORDER BY sector")
    with engine.connect() as conn:
        rows = conn.execute(sql).fetchall()
    return [r[0] for r in rows]
