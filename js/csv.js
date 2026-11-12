// js/csv.js
const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

function parseCTraderDate(str) {
  // Format: "30 Oct 2026 08:57:37.770"
  const m = str.match(/^(\d+)\s+(\w+)\s+(\d+)\s+(\d+):(\d+):(\d+)\.(\d+)/);
  if (!m) return str;
  const [, day, mon, year, h, min, s, ms] = m;
  return new Date(Date.UTC(+year, MONTHS[mon], +day, +h, +min, +s, +ms)).toISOString();
}

function parseNum(str) {
  return parseFloat(str.replace(/\s/g, ''));
}

function buildKey(symbol, closeTime, entryPrice, exitPrice) {
  return `${symbol}|${closeTime}|${entryPrice}|${exitPrice}`;
}

export function parseCSV(text) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Line 0: "Transactions", Line 1: column headers, Line 2+: data
  const dataLines = lines.slice(2);

  const trades = [];

  for (const line of dataLines) {
    const cols = line.split(',');
    if (cols.length < 8) continue;

    const symbol      = cols[0].trim();
    const direction   = cols[1].trim();
    const closeRaw    = cols[2].trim();
    const entryRaw    = cols[3].trim();
    const exitRaw     = cols[4].trim();
    const quantity    = cols[5].trim();
    const pipsRaw     = cols[6].trim();
    const netUSDRaw   = cols[7].trim();

    if (symbol !== 'XAUUSD') continue;

    const entryPrice = parseNum(entryRaw);
    const exitPrice  = parseNum(exitRaw);
    const pips       = parseNum(pipsRaw);
    const netUSD     = parseNum(netUSDRaw);

    if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(pips)) continue;

    const closeTime = parseCTraderDate(closeRaw);
    const key = buildKey(symbol, closeTime, entryPrice, exitPrice);

    trades.push({
      key,
      symbol,
      direction,
      closeTime,
      entryPrice,
      exitPrice,
      quantity,
      pips,
      netUSD,
      note: null
    });
  }

  return trades;
}
