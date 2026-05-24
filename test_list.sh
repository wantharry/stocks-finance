#!/usr/bin/env bash
cd /home/openclaw/projects/finance/backend
source .venv/bin/activate
python -c "
from data.stock_list import get_top_stocks
t = get_top_stocks(1000)
print(f'Got {len(t)} tickers')
print(t[:10])
"
