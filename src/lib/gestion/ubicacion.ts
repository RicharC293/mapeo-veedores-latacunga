import type { ParroquiaBasica, Recinto } from "../types";

// Un solo filtro de ubicación: todo el cantón, todas las parroquias urbanas,
// todas las rurales, o una parroquia concreta (por su código).
export type Ubicacion = "todas" | "urbanas" | "rurales" | number;

export function coincideUbicacion(
  ubicacion: Ubicacion,
  parroquia: ParroquiaBasica | undefined,
): boolean {
  if (ubicacion === "todas") return true;
  if (!parroquia) return false;
  if (ubicacion === "urbanas") return parroquia.properties.urbana;
  if (ubicacion === "rurales") return !parroquia.properties.urbana;
  return parroquia.properties.code === ubicacion;
}

// Valor de un <select> → Ubicacion.
export function leerUbicacion(valor: string): Ubicacion {
  if (valor === "urbanas" || valor === "rurales") return valor;
  const codigo = Number(valor);
  return valor !== "" && Number.isFinite(codigo) ? codigo : "todas";
}

export interface GrupoParroquia<T> {
  parroquia: ParroquiaBasica | undefined;
  items: T[];
}

// Agrupa por parroquia (orden alfabético) y ordena los recintos de cada grupo.
export function agruparPorParroquia<T extends { recinto: Recinto }>(
  items: T[],
  parroquias: ParroquiaBasica[],
): GrupoParroquia<T>[] {
  const porCodigo = new Map(parroquias.map((p) => [p.properties.code, p]));
  const mapa = new Map<number, T[]>();
  for (const item of items) {
    mapa.set(item.recinto.par, [...(mapa.get(item.recinto.par) ?? []), item]);
  }
  return [...mapa.entries()]
    .map(([codigo, delGrupo]) => ({
      parroquia: porCodigo.get(codigo),
      items: [...delGrupo].sort((a, b) =>
        a.recinto.nombre.localeCompare(b.recinto.nombre),
      ),
    }))
    .sort((a, b) =>
      (a.parroquia?.properties.name ?? "").localeCompare(
        b.parroquia?.properties.name ?? "",
      ),
    );
}
