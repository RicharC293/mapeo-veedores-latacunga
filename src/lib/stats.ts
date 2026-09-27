import type { MapData, ParroquiaStats, Totales } from "./types";

export function buildParroquiaStats(
  data: MapData,
): Record<number, ParroquiaStats> {
  const stats: Record<number, ParroquiaStats> = {};
  for (const f of data.parroquias.features) {
    stats[f.properties.code] = { rec: 0, el: 0, jt: 0, jf: 0, jm: 0 };
  }
  for (const r of data.recintos) {
    const s = stats[r.par];
    s.rec += 1;
    s.el += r.el;
    s.jt += r.jt;
    s.jf += r.jf;
    s.jm += r.jm;
  }
  return stats;
}

export function buildTotales(data: MapData): Totales {
  return data.recintos.reduce<Totales>(
    (a, r) => ({
      el: a.el + r.el,
      jt: a.jt + r.jt,
      jf: a.jf + r.jf,
      jm: a.jm + r.jm,
    }),
    { el: 0, jt: 0, jf: 0, jm: 0 },
  );
}

export function buildParByCode(data: MapData) {
  return new Map(data.parroquias.features.map((f) => [f.properties.code, f]));
}

export function buildRecByCod(data: MapData) {
  return new Map(data.recintos.map((r) => [r.cod, r]));
}
