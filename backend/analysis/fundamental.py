"""
Extract and normalise fundamental data from a yfinance .info dict.
"""
from typing import Any


def _get(info: dict, *keys, default=None):
    """Return first non-None value among the given keys."""
    for k in keys:
        v = info.get(k)
        if v is not None and v != "N/A":
            try:
                return float(v)
            except (TypeError, ValueError):
                # string value (sector, name, …)
                return v
    return default


def extract_fundamentals(ticker: str, info: dict[str, Any]) -> dict:
    """
    Parse yfinance info dict into structured metadata + fundamentals dict.
    All numeric values are float or None.
    """
    name = info.get("longName") or info.get("shortName") or ticker
    sector = info.get("sector") or "Unknown"
    industry = info.get("industry") or "Unknown"
    country = info.get("country") or "US"
    market_cap = _get(info, "marketCap")
    employees = _get(info, "fullTimeEmployees")
    description = (info.get("longBusinessSummary") or "")[:500]  # trim for DB

    fundamentals = {
        "pe_ratio": _get(info, "trailingPE"),
        "pb_ratio": _get(info, "priceToBook"),
        "ps_ratio": _get(info, "priceToSalesTrailing12Months"),
        "peg_ratio": _get(info, "pegRatio"),
        "forward_pe": _get(info, "forwardPE"),
        "revenue_growth": _get(info, "revenueGrowth"),   # as decimal, e.g. 0.12 = 12 %
        "earnings_growth": _get(info, "earningsGrowth"),
        "roe": _get(info, "returnOnEquity"),
        "roa": _get(info, "returnOnAssets"),
        "debt_equity": _get(info, "debtToEquity"),
        "current_ratio": _get(info, "currentRatio"),
        "profit_margin": _get(info, "profitMargins"),
        "dividend_yield": _get(info, "dividendYield"),
        "beta": _get(info, "beta"),
        "week52_high": _get(info, "fiftyTwoWeekHigh"),
        "week52_low": _get(info, "fiftyTwoWeekLow"),
    }

    return {
        "ticker": ticker,
        "name": name,
        "sector": sector,
        "industry": industry,
        "country": country,
        "market_cap": market_cap,
        "employees": int(employees) if employees else None,
        "description": description,
        "fundamentals": fundamentals,
    }
