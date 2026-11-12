/** Round tick values ("nice numbers") covering [min, max] with about `count` steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) {
    const pad = Math.abs(max) * 0.1 || 1;
    return niceTicks(min - pad, max + pad, count);
  }
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i <= 2 * count + 2; i += 1) {
    const v = Number((start + i * step).toFixed(10));
    ticks.push(v);
    if (v >= max && ticks.length >= 2) break;
  }
  return ticks;
}

/** Maps [d0, d1] linearly onto [r0, r1]. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}
