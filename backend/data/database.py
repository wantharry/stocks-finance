"""
SQLite database setup and access helpers using SQLAlchemy Core.
Tables:
  stocks          – static info (name, sector, market cap …)
  stock_prices    – daily OHLCV history
  stock_analysis  – computed indicators and scores
  market_indices  – snapshot of major indices
  refresh_status  – tracks background refresh progress
"""
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import (
    Column, Float, Integer, MetaData, String, Table, Text,
    UniqueConstraint, create_engine, text,
)
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

_db_path = os.environ.get("DB_PATH", "./stockiq.db")
DB_URL = f"sqlite:///{_db_path}"

engine: Engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
metadata = MetaData()

# ── table definitions ──────────────────────────────────────────────────────

stocks = Table(
    "stocks",
    metadata,
    Column("ticker", String(10), primary_key=True),
    Column("name", Text),
    Column("sector", Text),
    Column("industry", Text),
    Column("country", Text),
    Column("market_cap", Float),
    Column("employees", Integer),
    Column("description", Text),
    Column("last_updated", Text),
)

stock_prices = Table(
    "stock_prices",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("ticker", String(10), nullable=False),
    Column("date", Text, nullable=False),
    Column("open", Float),
    Column("high", Float),
    Column("low", Float),
    Column("close", Float),
    Column("adj_close", Float),
    Column("volume", Float),
    UniqueConstraint("ticker", "date", name="uq_ticker_date"),
)

stock_analysis = Table(
    "stock_analysis",
    metadata,
    Column("ticker", String(10), primary_key=True),
    # Price snapshot
    Column("current_price", Float),
    Column("price_change", Float),
    Column("price_change_pct", Float),
    Column("volume", Float),
    Column("avg_volume", Float),
    # Technical indicators
    Column("rsi", Float),
    Column("macd", Float),
    Column("macd_signal", Float),
    Column("macd_hist", Float),
    Column("sma_50", Float),
    Column("sma_200", Float),
    Column("ema_12", Float),
    Column("ema_26", Float),
    Column("bb_upper", Float),
    Column("bb_middle", Float),
    Column("bb_lower", Float),
    Column("bb_width", Float),
    # Fundamental data
    Column("pe_ratio", Float),
    Column("pb_ratio", Float),
    Column("ps_ratio", Float),
    Column("peg_ratio", Float),
    Column("forward_pe", Float),
    Column("revenue_growth", Float),
    Column("earnings_growth", Float),
    Column("roe", Float),
    Column("roa", Float),
    Column("debt_equity", Float),
    Column("current_ratio", Float),
    Column("profit_margin", Float),
    Column("dividend_yield", Float),
    Column("beta", Float),
    Column("week52_high", Float),
    Column("week52_low", Float),
    # Scores
    Column("technical_score", Float),
    Column("fundamental_score", Float),
    Column("overall_score", Float),
    Column("recommendation", Text),
    Column("confidence", Float),
    Column("last_analyzed", Text),
)

market_indices = Table(
    "market_indices",
    metadata,
    Column("symbol", String(10), primary_key=True),
    Column("name", Text),
    Column("price", Float),
    Column("change", Float),
    Column("change_pct", Float),
    Column("last_updated", Text),
)

refresh_status = Table(
    "refresh_status",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("started_at", Text),
    Column("finished_at", Text),
    Column("total", Integer),
    Column("completed", Integer),
    Column("status", Text),  # "running" | "done" | "error"
    Column("message", Text),
)


def init_db() -> None:
    """Create all tables; recreates if schema is outdated (dev mode)."""
    with engine.connect() as conn:
        try:
            conn.execute(text("SELECT week52_high FROM stock_analysis LIMIT 1"))
        except Exception:
            logger.info("Schema outdated or missing — recreating tables")
            metadata.drop_all(engine)
    metadata.create_all(engine)
    logger.info("Database initialised")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_stock(conn, data: dict) -> None:
    stmt = text("""
        INSERT INTO stocks (ticker, name, sector, industry, country, market_cap, employees, description, last_updated)
        VALUES (:ticker, :name, :sector, :industry, :country, :market_cap, :employees, :description, :last_updated)
        ON CONFLICT(ticker) DO UPDATE SET
            name=excluded.name, sector=excluded.sector, industry=excluded.industry,
            country=excluded.country, market_cap=excluded.market_cap,
            employees=excluded.employees, description=excluded.description,
            last_updated=excluded.last_updated
    """)
    conn.execute(stmt, data)


def upsert_analysis(conn, data: dict) -> None:
    keys = ", ".join(data.keys())
    placeholders = ", ".join(f":{k}" for k in data.keys())
    updates = ", ".join(f"{k}=excluded.{k}" for k in data.keys() if k != "ticker")
    stmt = text(f"""
        INSERT INTO stock_analysis ({keys}) VALUES ({placeholders})
        ON CONFLICT(ticker) DO UPDATE SET {updates}
    """)
    conn.execute(stmt, data)


def bulk_insert_prices(conn, rows: list[dict]) -> None:
    if not rows:
        return
    stmt = text("""
        INSERT OR IGNORE INTO stock_prices (ticker, date, open, high, low, close, adj_close, volume)
        VALUES (:ticker, :date, :open, :high, :low, :close, :adj_close, :volume)
    """)
    conn.execute(stmt, rows)
