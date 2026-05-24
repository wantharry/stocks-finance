"""
Stock list provider.
Fetches top ~1000 US stocks from Wikipedia (S&P 500, NASDAQ 100, Dow 30)
plus a curated supplement list. Falls back to a static list if scraping fails.
"""
import io
import logging
from typing import List

import pandas as pd
import requests

logger = logging.getLogger(__name__)

# Wikipedia blocks default urllib User-Agent; use a browser-like one
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _safe_read_html(url: str) -> list:
    """Fetch page with browser-like headers, then parse tables."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
        return pd.read_html(io.StringIO(resp.text))
    except Exception as e:
        logger.warning(f"read_html failed for {url}: {e}")
        return []


# ──────────────────────────────────────────────
# Supplement: popular stocks not always in S&P 500 / NASDAQ 100
# ──────────────────────────────────────────────
SUPPLEMENT_TICKERS: List[str] = [
    # Cloud / SaaS
    "NET", "SNOW", "DDOG", "MDB", "PLTR", "RBLX", "COIN", "HOOD", "SOFI",
    "TWLO", "ZM", "DOCU", "TEAM", "OKTA", "HUBS", "PAYC", "PCTY", "AVLR",
    # Fintech
    "SQ", "PYPL", "AFRM", "UPST", "GPN", "FIS", "FISV", "WEX",
    # EV / Clean Energy
    "RIVN", "LCID", "NIO", "XPEV", "LI", "FSLR", "ENPH", "PLUG", "BLNK",
    # Biotech / Pharma
    "MRNA", "BNTX", "NVAX", "SGEN", "BIIB", "ILMN", "HOLX", "PODD",
    # Cybersecurity
    "CRWD", "PANW", "FTNT", "CHKP", "S", "VRNT",
    # Social / Media
    "SNAP", "PINS", "RDDT", "MTCH",
    # Gaming / Entertainment
    "DKNG", "PENN", "RBLX", "EA", "TTWO",
    # E-commerce / Retail
    "ETSY", "W", "SHOP",
    # International ADRs
    "TSM", "BABA", "JD", "PDD", "BIDU",
    # Airlines
    "AAL", "DAL", "UAL", "LUV", "JBLU", "SAVE",
    # Cruise / Travel
    "CCL", "RCL", "NCLH", "ABNB", "EXPE", "BKNG",
    # REIT
    "O", "WPC", "NNN", "AMT", "CCI", "EQIX", "PLD", "PSA", "EXR",
    # Commodities / Mining
    "NEM", "GOLD", "AEM", "WPM", "FNV", "FCX", "AA",
    # Ride-share / Delivery
    "UBER", "LYFT", "DASH",
    # Logistics
    "XPO", "SAIA", "ODFL", "JBHT",
    # Meme / retail popular
    "GME", "AMC", "BB",
    # SPACs / indices (useful for context)
    "SPY", "QQQ", "IWM", "DIA",
]


def _safe_read_html(url: str) -> list:
    """Fetch page with browser-like headers, then parse tables."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=15)
        resp.raise_for_status()
        return pd.read_html(io.StringIO(resp.text))
    except Exception as e:
        logger.warning(f"read_html failed for {url}: {e}")
        return []


def get_sp500_tickers() -> List[str]:
    tables = _safe_read_html("https://en.wikipedia.org/wiki/List_of_S%26P_500_companies")
    if not tables:
        return []
    df = tables[0]
    if "Symbol" not in df.columns:
        return []
    tickers = df["Symbol"].dropna().tolist()
    tickers = [str(t).replace(".", "-").strip().upper() for t in tickers]
    logger.info(f"S&P 500: {len(tickers)} tickers")
    return tickers


def get_nasdaq100_tickers() -> List[str]:
    tables = _safe_read_html("https://en.wikipedia.org/wiki/Nasdaq-100")
    for df in tables:
        col = None
        if "Ticker" in df.columns:
            col = "Ticker"
        elif "Symbol" in df.columns:
            col = "Symbol"
        if col:
            tickers = df[col].dropna().tolist()
            tickers = [str(t).replace(".", "-").strip().upper() for t in tickers if str(t).strip()]
            if len(tickers) >= 80:
                logger.info(f"NASDAQ 100: {len(tickers)} tickers")
                return tickers
    return []


def get_dow30_tickers() -> List[str]:
    tables = _safe_read_html("https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average")
    for df in tables:
        if "Symbol" in df.columns:
            tickers = df["Symbol"].dropna().tolist()
            tickers = [str(t).replace(".", "-").strip().upper() for t in tickers if str(t).strip()]
            if 20 <= len(tickers) <= 50:
                logger.info(f"Dow 30: {len(tickers)} tickers")
                return tickers
    return []


# Fallback static list (~400 large-caps) used if Wikipedia is unreachable
FALLBACK_TICKERS: List[str] = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "GOOG", "AMZN", "META", "TSLA", "BRK-B",
    "LLY", "AVGO", "JPM", "V", "UNH", "XOM", "MA", "JNJ", "PG", "HD",
    "COST", "MRK", "ABBV", "CVX", "CRM", "AMD", "ORCL", "BAC", "NFLX", "KO",
    "PEP", "TMO", "WMT", "ADBE", "MCD", "CSCO", "ABT", "DIS", "ACN", "INTC",
    "WFC", "AMGN", "PM", "INTU", "IBM", "CMCSA", "VZ", "GE", "TXN", "QCOM",
    "NOW", "SPGI", "HON", "AMAT", "BKNG", "MS", "GS", "CAT", "NEE", "T",
    "AXP", "UNP", "LOW", "COP", "RTX", "SBUX", "PFE", "DE", "ADP", "ISRG",
    "SYK", "MDLZ", "VRTX", "GILD", "ADI", "PANW", "BMY", "TMUS", "MO", "CB",
    "CI", "REGN", "LRCX", "KLAC", "MRVL", "SNPS", "CDNS", "FTNT", "ELV", "HCA",
    "MCK", "CME", "ICE", "PGR", "SO", "DUK", "AON", "TJX", "USB", "SHW",
    "ITW", "MMM", "ETN", "NSC", "CSX", "EMR", "FDX", "MET", "PRU", "AFL",
    "TRV", "HIG", "ALL", "CNC", "HUM", "MCO", "MSCI", "IQV", "DHR", "ZTS",
    "IDXX", "BSX", "EW", "BDX", "DXCM", "CVS", "WBA", "GIS", "K", "HSY",
    "CAG", "MKC", "CHD", "CLX", "KMB", "CL", "TGT", "EBAY", "FIVE", "DLTR",
    "DG", "YUM", "CMG", "DPZ", "QSR", "DRI", "EAT", "TXRH", "MAR", "HLT",
    "SPG", "O", "PLD", "PSA", "EXR", "AVB", "EQR", "AMT", "CCI", "EQIX",
    "BA", "LMT", "RTX", "NOC", "GD", "HAL", "SLB", "BKR", "LIN", "APD",
    "EMN", "DD", "DOW", "PPG", "SHW", "FMC", "ALB", "NEM", "GOLD", "FCX",
    "AA", "NUE", "STLD", "F", "GM", "UBER", "LYFT", "DASH", "UPS", "FDX",
    "XPO", "SAIA", "ODFL", "JBHT", "AAL", "DAL", "UAL", "LUV", "CCL", "RCL",
    "NCLH", "ABNB", "EXPE", "MGM", "WYNN", "LVS", "PENN", "DKNG", "EA", "TTWO",
    "ATVI", "RBLX", "U", "NET", "SNOW", "DDOG", "MDB", "PLTR", "CRWD", "S",
    "OKTA", "ZM", "DOCU", "TWLO", "HUBS", "SQ", "PYPL", "AFRM", "COIN", "HOOD",
    "SOFI", "SNAP", "PINS", "MTCH", "SHOP", "ETSY", "W", "MRNA", "BNTX", "NVAX",
    "BIIB", "ILMN", "SGEN", "FSLR", "ENPH", "RIVN", "LCID", "NIO", "XPEV",
    "LI", "TSM", "BABA", "JD", "PDD", "BIDU", "GME", "AMC",
]


def get_top_stocks(limit: int = 1000) -> List[str]:
    """
    Return up to `limit` unique US stock tickers, sorted roughly by importance.
    Sources (in priority order): S&P 500 → NASDAQ 100 → Dow 30 → supplement.
    Falls back to FALLBACK_TICKERS if Wikipedia is unreachable.
    """
    seen: set = set()
    result: List[str] = []

    def _add(tickers: List[str]) -> None:
        for t in tickers:
            t = t.strip().upper()
            # Basic validity: 1-5 chars, letters and hyphens only
            if t and t not in seen and 1 <= len(t) <= 6 and all(c.isalpha() or c == "-" for c in t):
                seen.add(t)
                result.append(t)

    _add(get_sp500_tickers())
    _add(get_nasdaq100_tickers())
    _add(get_dow30_tickers())
    _add(SUPPLEMENT_TICKERS)

    if len(result) < 100:
        logger.warning("Wikipedia scraping yielded too few tickers — using fallback list")
        _add(FALLBACK_TICKERS)

    logger.info(f"Total unique tickers: {len(result)} (limit={limit})")
    return result[:limit]
