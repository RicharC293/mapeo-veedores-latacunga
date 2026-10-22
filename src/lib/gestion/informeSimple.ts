import type { FilaRecinto } from "./cifras";

// Dos análisis: "noverificado" cuenta a todos los titulares ingresados, estén
// o no verificados; "verificado" cuenta solo a los ya verificados (los que
// están ingresados pero sin verificar figuran como faltantes).
export type AnalisisSimple = "noverificado" | "verificado";

// El Informe simple: por parroquia (urbana o rural) y recinto, solo lo que
// hay y lo que falta de coordinador, veedores y, si aplica, CDA.
export interface RecintoSimple {
  recinto: string;
  coordinador: boolean;
  veedoresTenemos: number;
  veedoresFaltan: number;
  // null cuando el recinto no es CDA.
  cda: boolean | null;
}

export interface ParroquiaSimple {
  nombre: string;
  urbana: boolean;
  recintos: RecintoSimple[];
}

// Parroquias urbanas primero y luego rurales, cada grupo por nombre; los
// recintos de cada parroquia, también por nombre.
export function armarInformeSimple(
  filas: FilaRecinto[],
  analisis: AnalisisSimple = "noverificado",
): ParroquiaSimple[] {
  const verificado = analisis === "verificado";
  const tiene = (c: { ingresados: number; verificados: number }) =>
    verificado ? c.verificados : c.ingresados;
  const porParroquia = new Map<number, ParroquiaSimple>();
  for (const f of [...filas].sort((a, b) =>
    a.recinto.localeCompare(b.recinto),
  )) {
    let p = porParroquia.get(f.parroquiaCodigo);
    if (!p) {
      p = { nombre: f.parroquia, urbana: f.urbana, recintos: [] };
      porParroquia.set(f.parroquiaCodigo, p);
    }
    p.recintos.push({
      recinto: f.recinto,
      coordinador: tiene(f.coordinadores) > 0,
      veedoresTenemos: tiene(f.veedores),
      veedoresFaltan: Math.max(0, f.veedores.requerido - tiene(f.veedores)),
      cda: f.esCda ? tiene(f.cda) > 0 : null,
    });
  }
  return [...porParroquia.values()].sort(
    (a, b) =>
      Number(b.urbana) - Number(a.urbana) || a.nombre.localeCompare(b.nombre),
  );
}
