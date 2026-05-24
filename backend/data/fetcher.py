"""
yfinance data fetcher — two-phase refresh strategy:

Phase 1 (fast, ~2-5 min): Download OHLCV prices chunk-by-chunk, compute
technical indicators, save to DB, and emit progress after every ticker.
Data becomes visible in the UI as each chunk completes.

Phase 2 (slow, background): Fetch per-ticker fundamental info one-by-one
with rate-limit-friendly delays and update scores/names in-place.
"""
import logging
import threading
import time
from typing import Any

import pandas as pd
import yfinance as yf

from data.database import (
    bulk_insert_prices,
    engine,
    now_iso,
    upsert_analysis,
    upsert_stock,
)
from analysis.technical import compute_indicators
from analysis.fundamental import extract_fundamentals
from analysis.scorer import score_stock
from sqlalchemy import text

logger = logging.getLogger(__name__)

HISTORY_PERIOD = "1y"
HISTORY_INTERVAL = "1d"
CHUNK_SIZE = 100  # tickers per yf.download() call

INDEX_SYMBOLS = {
    "^GSPC": "S&P 500",
    "^IXIC": "NASDAQ Composite",
    "^DJI": "Dow Jones",
    "^RUT": "Russell 2000",
    "^VIX": "VIX",
}


# ──────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────

def _download_chunk(chunk: list[str]) -> dict[str, pd.DataFrame]:
    """Download 1-year OHLCV for a chunk of tickers. Returns ticker→DataFrame."""
    ticker_str = " ".join(chunk)
    result: dict[str, pd.DataFrame] = {}
    try:
        raw = yf.download(
            ticker_str,
            period=HISTORY_PERIOD,
            interval=HISTORY_INTERVAL,
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        if raw.empty:
            return result
        # yfinance 1.4+ always returns MultiIndex (ticker, field) regardless of chunk size
        for ticker in chunk:
            try:
                df = raw[ticker].dropna(how="all")
                if not df.empty:
                    result[ticker] = df
            except KeyError:
                pass
    except Exception as e:
        logger.error(f"Chunk download error: {e}")
    return result


def _save_prices(ticker: str, df: pd.DataFrame) -> list[dict]:
    rows = []
    for date, row in df.iterrows():
        rows.append({
            "ticker": ticker,
            "date": str(date.date()) if hasattr(date, "date") else str(date),
            "open": _f(row.get("Open")),
            "high": _f(row.get("High")),
            "low": _f(row.get("Low")),
            "close": _f(row.get("Close")),
            "adj_close": _f(row.get("Close")),
            "volume": _f(row.get("Volume")),
        })
    with engine.begin() as conn:
        bulk_insert_prices(conn, rows)
    return rows


def _process_prices(ticker: str, price_df: pd.DataFrame | None) -> bool:
    """
    Phase 1: save prices + compute technicals. No fundamental HTTP calls.
    Returns True on success.
    """
    try:
        if price_df is None or price_df.empty:
            return False

        price_rows = _save_prices(ticker, price_df)
        closes = pd.Series(
            [r["close"] for r in price_rows if r["close"] is not None], dtype=float
        )
        volumes = pd.Series(
            [r["volume"] for r in price_rows if r["volume"] is not None], dtype=float
        )

        if len(closes) < 14:
            return False

        tech = compute_indicators(closes)
        current_close = float(closes.iloc[-1])
        prev_close = float(closes.iloc[-2]) if len(closes) > 1 else current_close
        price_change = current_close - prev_close
        price_change_pct = (price_change / prev_close * 100) if prev_close else 0.0
        avg_volume = float(volumes.tail(20).mean()) if len(volumes) >= 20 else (
            float(volumes.mean()) if len(volumes) > 0 else None
        )

        scores = score_stock(tech, {})

        with engine.begin() as conn:
            upsert_stock(conn, {
                "ticker": ticker,
                "name": ticker,  # placeholder; enriched in phase 2
                "sector": None, "industry": None, "country": None,
                "market_cap": None, "employees": None, "description": None,
                "last_updated": now_iso(),
            })
            upsert_analysis(conn, {
                "ticker": ticker,
                "current_price": current_close,
                "price_change": price_change,
                "price_change_pct": price_change_pct,
                "volume": float(volumes.iloc[-1]) if len(volumes) > 0 else None,
                "avg_volume": avg_volume,
                **{k: _f(v) for k, v in tech.items()},
                # fundamental fields empty initially
                "pe_ratio": None, "pb_ratio": None, "ps_ratio": None,
                "peg_ratio": None, "forward_pe": None,
                "revenue_growth": None, "earnings_growth": None,
                "roe": None, "roa": None, "debt_equity": None,
                "current_ratio": None, "profit_margin": None,
                "dividend_yield": None, "beta": None,
                "week52_high": None, "week52_low": None,
                "technical_score": scores["technical_score"],
                "fundamental_score": scores["fundamental_score"],
                "overall_score": scores["overall_score"],
                "recommendation": scores["recommendation"],
                "confidence": scores["confidence"],
                "last_analyzed": now_iso(),
            })
        return True

    except Exception as e:
        logger.error(f"Error processing {ticker}: {e}")
        return False


def _enrich_fundamentals(tickers: list[str]) -> None:
    """
    Phase 2 (background): fetch per-ticker info from Yahoo Finance slowly
    and update name/sector/fundamental scores in-place.
    """
    logger.info(f"Starting fundamental enrichment for {len(tickers)} tickers")
    for ticker in tickers:
        try:
            info = fetch_info(ticker)
            if not info:
                time.sleep(1)
                continue

            meta = extract_fundamentals(ticker, info)
            fund = meta["fundamentals"]

            with engine.connect() as conn:
                row = conn.execute(
                    text("SELECT rsi, macd, macd_signal, sma_50, sma_200, bb_upper, bb_lower, bb_middle FROM stock_analysis WHERE ticker=:t"),
                    {"t": ticker},
                ).mappings().first()

            if not row:
                time.sleep(1)
                continue

            tech_partial = dict(row)
            scores = score_stock(tech_partial, fund)

            with engine.begin() as conn:
                upsert_stock(conn, {
                    "ticker": ticker,
                    "name": meta["name"],
                    "sector": meta["sector"],
                    "industry": meta["industry"],
                    "country": meta["country"],
                    "market_cap": meta["market_cap"],
                    "employees": meta["employees"],
                    "description": meta["description"],
                    "last_updated": now_iso(),
                })
                conn.execute(text("""
                    UPDATE stock_analysis SET
                        pe_ratio=:pe_ratio, pb_ratio=:pb_ratio, ps_ratio=:ps_ratio,
                        peg_ratio=:peg_ratio, forward_pe=:forward_pe,
                        revenue_growth=:revenue_growth, earnings_growth=:earnings_growth,
                        roe=:roe, roa=:roa, debt_equity=:debt_equity,
                        current_ratio=:current_ratio, profit_margin=:profit_margin,
                        dividend_yield=:dividend_yield, beta=:beta,
                        week52_high=:week52_high, week52_low=:week52_low,
                        fundamental_score=:fundamental_score,
                        overall_score=:overall_score,
                        recommendation=:recommendation,
                        last_analyzed=:last_analyzed
                    WHERE ticker=:ticker
                """), {
                    "ticker": ticker,
                    "pe_ratio": _f(fund.get("pe_ratio")),
                    "pb_ratio": _f(fund.get("pb_ratio")),
                    "ps_ratio": _f(fund.get("ps_ratio")),
                    "peg_ratio": _f(fund.get("peg_ratio")),
                    "forward_pe": _f(fund.get("forward_pe")),
                    "revenue_growth": _f(fund.get("revenue_growth")),
                    "earnings_growth": _f(fund.get("earnings_growth")),
                    "roe": _f(fund.get("roe")),
                    "roa": _f(fund.get("roa")),
                    "debt_equity": _f(fund.get("debt_equity")),
                    "current_ratio": _f(fund.get("current_ratio")),
                    "profit_margin": _f(fund.get("profit_margin")),
                    "dividend_yield": _f(fund.get("dividend_yield")),
                    "beta": _f(fund.get("beta")),
                    "week52_high": _f(fund.get("week52_high")),
                    "week52_low": _f(fund.get("week52_low")),
                    "fundamental_score": scores["fundamental_score"],
                    "overall_score": scores["overall_score"],
                    "recommendation": scores["recommendation"],
                    "last_analyzed": now_iso(),
                })

        except Exception as e:
            logger.error(f"Enrichment error {ticker}: {e}")

        time.sleep(2)  # 2 s between fundamental calls to avoid rate-limiting

    logger.info("Fundamental enrichment complete")


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def fetch_info(ticker: str) -> dict[str, Any]:
    """Fetch yfinance .info dict with retry."""
    for attempt in range(2):
        try:
            info = yf.Ticker(ticker).info or {}
            return info
        except Exception as e:
            logger.warning(f"{ticker} info attempt {attempt + 1} failed: {e}")
            time.sleep(2 ** attempt)
    return {}


def run_full_refresh(tickers: list[str], on_progress=None) -> tuple[int, int]:
    """
    Phase 1: download prices chunk-by-chunk, process immediately, emit progress.
    Phase 2: starts a background thread for fundamental enrichment.
    Returns (success_count, total).
    """
    logger.info(f"Starting price refresh for {len(tickers)} tickers")
    success = 0
    completed = 0

    for chunk_start in range(0, len(tickers), CHUNK_SIZE):
        chunk = tickers[chunk_start : chunk_start + CHUNK_SIZE]
        logger.info(f"Chunk {chunk_start // CHUNK_SIZE + 1}: downloading {len(chunk)} tickers")
        price_map = _download_chunk(chunk)

        for ticker in chunk:
            ok = _process_prices(ticker, price_map.get(ticker))
            if ok:
                success += 1
            completed += 1
            if on_progress:
                on_progress(completed, len(tickers))

        time.sleep(1)  # brief pause between chunks

    logger.info(f"Price refresh done: {success}/{completed} tickers saved")

    # Start background fundamental enrichment (non-blocking)
    thread = threading.Thread(
        target=_enrich_fundamentals, args=(tickers,), daemon=True
    )
    thread.start()

    return success, len(tickers)


# ──────────────────────────────────────────────
# Market indices
# ──────────────────────────────────────────────

def fetch_market_indices() -> list[dict]:
    results = []
    for symbol, name in INDEX_SYMBOLS.items():
        try:
            t = yf.Ticker(symbol)
            info = t.fast_info
            price = getattr(info, "last_price", None)
            prev = getattr(info, "previous_close", None)
            if price and prev:
                change = price - prev
                change_pct = change / prev * 100
            else:
                change = change_pct = 0.0
            results.append({
                "symbol": symbol,
                "name": name,
                "price": _f(price),
                "change": _f(change),
                "change_pct": _f(change_pct),
                "last_updated": now_iso(),
            })
        except Exception as e:
            logger.warning(f"Index {symbol} failed: {e}")
    return results




# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _f(v) -> float | None:
    """Safe float conversion — returns None for NaN / non-numeric values."""
    try:
        f = float(v)
        if f != f:  # NaN check
            return None
        return f
    except (TypeError, ValueError):
        return None

