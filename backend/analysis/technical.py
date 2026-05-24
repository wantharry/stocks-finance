"""
Pure-pandas technical indicator calculations.
No external TA library dependency — avoids compatibility issues.
"""
import pandas as pd


def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _sma(series: pd.Series, period: int) -> pd.Series:
    return series.rolling(window=period).mean()


# ── Individual indicators ────────────────────────────────────────────────

def rsi(closes: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index (0–100)."""
    delta = closes.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, float("nan"))
    return 100 - (100 / (1 + rs))


def macd(closes: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (macd_line, signal_line, histogram)."""
    fast_ema = _ema(closes, fast)
    slow_ema = _ema(closes, slow)
    macd_line = fast_ema - slow_ema
    signal_line = _ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(closes: pd.Series, period: int = 20, num_std: float = 2.0) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (upper, middle/SMA, lower)."""
    middle = _sma(closes, period)
    std = closes.rolling(window=period).std()
    upper = middle + num_std * std
    lower = middle - num_std * std
    return upper, middle, lower


# ── Aggregated indicator dict ────────────────────────────────────────────

def compute_indicators(closes: pd.Series) -> dict:
    """
    Run all indicators on a price series and return the latest values as a dict.
    Returns None for any indicator that cannot be computed.
    """
    def last(series: pd.Series):
        if series is None or series.empty:
            return None
        v = series.dropna()
        return float(v.iloc[-1]) if len(v) > 0 else None

    result: dict = {}

    # RSI
    if len(closes) >= 15:
        r = rsi(closes)
        result["rsi"] = last(r)
    else:
        result["rsi"] = None

    # MACD
    if len(closes) >= 27:
        macd_line, signal_line, histogram = macd(closes)
        result["macd"] = last(macd_line)
        result["macd_signal"] = last(signal_line)
        result["macd_hist"] = last(histogram)
        result["ema_12"] = last(_ema(closes, 12))
        result["ema_26"] = last(_ema(closes, 26))
    else:
        result["macd"] = result["macd_signal"] = result["macd_hist"] = None
        result["ema_12"] = result["ema_26"] = None

    # Moving Averages
    result["sma_50"] = last(_sma(closes, 50)) if len(closes) >= 50 else None
    result["sma_200"] = last(_sma(closes, 200)) if len(closes) >= 200 else None

    # Bollinger Bands
    if len(closes) >= 20:
        upper, middle, lower = bollinger_bands(closes)
        result["bb_upper"] = last(upper)
        result["bb_middle"] = last(middle)
        result["bb_lower"] = last(lower)
        bbu = last(upper)
        bbl = last(lower)
        result["bb_width"] = ((bbu - bbl) / last(middle) * 100) if (bbu and bbl and last(middle)) else None
    else:
        result["bb_upper"] = result["bb_middle"] = result["bb_lower"] = result["bb_width"] = None

    return result


def get_history_for_chart(closes: pd.Series, index: pd.Index) -> list[dict]:
    """Build RSI + MACD series aligned with price dates for charting."""
    if len(closes) < 27:
        return []

    rsi_series = rsi(closes)
    macd_line, signal_line, histogram = macd(closes)

    rows = []
    for i, date in enumerate(index):
        rows.append({
            "date": str(date.date()) if hasattr(date, "date") else str(date),
            "rsi": _safe_float(rsi_series.iloc[i]),
            "macd": _safe_float(macd_line.iloc[i]),
            "macd_signal": _safe_float(signal_line.iloc[i]),
            "macd_hist": _safe_float(histogram.iloc[i]),
        })
    return rows


def _safe_float(v) -> float | None:
    try:
        f = float(v)
        return None if f != f else f  # NaN → None
    except (TypeError, ValueError):
        return None
