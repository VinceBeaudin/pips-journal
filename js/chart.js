// js/chart.js
export function renderChart(container, trades) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.closeTime) - new Date(b.closeTime)
  );

  if (sorted.length === 0) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100%;color:#8596a3;gap:6px;font-size:12px;">
        <span style="font-size:22px;">◫</span>
        <span>Importe un CSV pour voir ta courbe</span>
      </div>`;
    return;
  }

  const W = 600, H = 160;
  const PAD = { l: 46, r: 14, t: 12, b: 22 };

  let cum = 0;
  const pts = sorted.map(t => ({ date: new Date(t.closeTime), v: (cum += t.pips) }));

  const values = [0, ...pts.map(p => p.v)];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi === lo) { lo -= 10; hi += 10; }
  const mg = (hi - lo) * 0.12;
  lo -= mg; hi += mg;

  const minT = pts[0].date.getTime();
  const maxT = pts.at(-1).date.getTime();
  const tRange = maxT - minT || 1;

  const toX = t => PAD.l + (t.getTime() - minT) / tRange * (W - PAD.l - PAD.r);
  const toY = v => H - PAD.b - (v - lo) / (hi - lo) * (H - PAD.t - PAD.b);

  const coords = [[PAD.l, toY(0)], ...pts.map(p => [toX(p.date), toY(p.v)])];
  const d = coords.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  const total = cum;
  const color = total >= 0 ? '#287763' : '#b45555';
  const fill  = total >= 0 ? '#eaf3ef' : '#fdf0ef';

  const lx = coords.at(-1)[0].toFixed(1);
  const ly = coords.at(-1)[1].toFixed(1);
  const base = toY(0).toFixed(1);

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">`;

  for (let i = 0; i <= 3; i++) {
    const v = lo + (hi - lo) * i / 3;
    const y = toY(v).toFixed(1);
    svg += `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="#e6edf1" ${i ? 'stroke-dasharray="3 5"' : ''}/>`;
    svg += `<text x="${PAD.l - 5}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#8596a3">${v.toFixed(0)}</text>`;
  }

  if (lo < 0 && hi > 0) {
    const y0 = toY(0).toFixed(1);
    svg += `<line x1="${PAD.l}" y1="${y0}" x2="${W - PAD.r}" y2="${y0}" stroke="#bcc8d0" stroke-width="0.75"/>`;
  }

  svg += `<path d="${d} L${lx},${base} L${PAD.l},${base} Z" fill="${fill}" opacity="0.65"/>`;
  svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  svg += `<circle cx="${lx}" cy="${ly}" r="3.5" fill="${color}"/>`;
  svg += `</svg>`;

  container.innerHTML = svg;
}
