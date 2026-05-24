"""
Scoring model: converts technical indicators + fundamental data into a
0–100 composite score and a Buy/Sell recommendation.

Weight split: 60 % technical, 40 % fundamental (falls back to 100 % technical
when fundamental data is unavailable).
"""
from typing import Optional


# ── Technical sub-scores (each 0–100) ───────────────────────────────────

def _rsi_score(rsi: Optional[float]) -> float:
    """Oversold = bullish (high score). Overbought = bearish (low score)."""
    if rsi is None:
        return 50.0
    if rsi <= 20:
        return 100.0
    if rsi <= 30:
        return 85.0
    if rsi <= 40:
        return 70.0
    if rsi <= 50:
        return 57.0
    if rsi <= 60:
        return 45.0
    if rsi <= 70:
        return 30.0
    if rsi <= 80:
        return 15.0
    return 5.0


def _macd_score(macd: Optional[float], signal: Optional[float]) -> float:
    """MACD crossover signals."""
    if macd is None or signal is None:
        return 50.0
    hist = macd - signal
    if macd > 0 and hist > 0:
        return 85.0   # above zero, bullish crossover
    if macd > 0 and hist <= 0:
        return 55.0   # above zero, bearish crossover
    if macd <= 0 and hist > 0:
        return 45.0   # below zero, bullish reversal
    return 20.0       # below zero, bearish


def _ma_score(price: Optional[float], sma_50: Optional[float], sma_200: Optional[float]) -> float:
    """Golden/death cross + price vs MA."""
    if price is None:
        return 50.0
    if sma_50 and sma_200:
        if price > sma_50 > sma_200:
            return 90.0   # strong uptrend
        if price > sma_50 and sma_50 <= sma_200:
            return 60.0
        if price <= sma_50 and sma_50 > sma_200:
            return 40.0
        return 10.0       # strong downtrend
    if sma_50:
        return 70.0 if price > sma_50 else 30.0
    return 50.0


def _bb_score(price: Optional[float], bb_upper: Optional[float], bb_lower: Optional[float]) -> float:
    """Price relative to Bollinger Bands."""
    if price is None or bb_upper is None or bb_lower is None:
        return 50.0
    band_width = bb_upper - bb_lower
    if band_width == 0:
        return 50.0
    position = (price - bb_lower) / band_width  # 0 = at lower, 1 = at upper
    if position <= 0:
        return 95.0   # below lower band → strongly oversold
    if position <= 0.15:
        return 80.0
    if position <= 0.35:
        return 65.0
    if position <= 0.65:
        return 50.0
    if position <= 0.85:
        return 35.0
    if position <= 1.0:
        return 20.0
    return 5.0        # above upper band → strongly overbought


# ── Fundamental sub-scores (each 0–100) ─────────────────────────────────

def _pe_score(pe: Optional[float]) -> float:
    if pe is None:
        return 50.0
    if pe < 0:
        return 10.0    # negative earnings
    if pe < 10:
        return 90.0    # very cheap
    if pe < 20:
        return 75.0
    if pe < 30:
        return 60.0
    if pe < 50:
        return 40.0
    if pe < 100:
        return 25.0
    return 10.0


def _growth_score(rev_growth: Optional[float], eps_growth: Optional[float]) -> float:
    """Accepts growth as decimals (0.15 = 15 %)."""
    def _single(g: Optional[float]) -> float:
        if g is None:
            return 50.0
        pct = g * 100
        if pct > 40:
            return 95.0
        if pct > 25:
            return 85.0
        if pct > 15:
            return 72.0
        if pct > 5:
            return 60.0
        if pct > 0:
            return 50.0
        if pct > -10:
            return 35.0
        return 15.0

    scores = [s for s in [_single(rev_growth), _single(eps_growth)] if s != 50.0]
    return sum(scores) / len(scores) if scores else 50.0


def _debt_score(debt_equity: Optional[float]) -> float:
    """Lower D/E = better."""
    if debt_equity is None:
        return 50.0
    if debt_equity < 0:
        return 50.0     # negative can mean many things
    if debt_equity < 30:
        return 90.0
    if debt_equity < 70:
        return 75.0
    if debt_equity < 150:
        return 55.0
    if debt_equity < 300:
        return 35.0
    return 15.0


# ── Master scorer ────────────────────────────────────────────────────────

def score_stock(tech: dict, fund: dict) -> dict:
    """
    Combine technical and fundamental sub-scores.
    Returns dict with technical_score, fundamental_score, overall_score,
    recommendation, and confidence (0–100).
    """
    price = tech.get("sma_50")  # proxy for current price not directly in tech
    # We need actual current_price but it's passed separately; use bb_middle as proxy
    price_proxy = tech.get("bb_middle") or tech.get("sma_50")

    rsi_val = tech.get("rsi")
    macd_val = tech.get("macd")
    macd_sig = tech.get("macd_signal")
    sma_50 = tech.get("sma_50")
    sma_200 = tech.get("sma_200")
    bb_upper = tech.get("bb_upper")
    bb_lower = tech.get("bb_lower")

    # Technical score (weighted)
    rs = _rsi_score(rsi_val)
    ms = _macd_score(macd_val, macd_sig)
    mas = _ma_score(price_proxy, sma_50, sma_200)
    bbs = _bb_score(price_proxy, bb_upper, bb_lower)

    tech_score = rs * 0.25 + ms * 0.30 + mas * 0.25 + bbs * 0.20

    # Fundamental score
    has_fund = any(fund.get(k) is not None for k in ["pe_ratio", "revenue_growth", "debt_equity"])
    if has_fund:
        fs = (
            _pe_score(fund.get("pe_ratio")) * 0.35
            + _growth_score(fund.get("revenue_growth"), fund.get("earnings_growth")) * 0.40
            + _debt_score(fund.get("debt_equity")) * 0.25
        )
        overall = tech_score * 0.60 + fs * 0.40
    else:
        fs = None
        overall = tech_score

    # Recommendation
    if overall >= 75:
        rec = "Strong Buy"
    elif overall >= 60:
        rec = "Buy"
    elif overall >= 45:
        rec = "Hold"
    elif overall >= 30:
        rec = "Sell"
    else:
        rec = "Strong Sell"

    # Confidence: fraction of technical signals that are bullish
    bullish = sum([
        rs > 55,
        ms > 55,
        mas > 55,
        bbs > 55,
    ])
    confidence = (bullish / 4) * 100.0

    return {
        "technical_score": round(tech_score, 1),
        "fundamental_score": round(fs, 1) if fs is not None else None,
        "overall_score": round(overall, 1),
        "recommendation": rec,
        "confidence": round(confidence, 1),
    }
