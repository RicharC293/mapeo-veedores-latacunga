import { pct } from "./coverage";

// Las seis cifras que se repiten en todas las tablas del informe.
export interface Cifras {
  // Puestos titulares que se necesitan: juntas, recintos o recintos CDA.
  requerido: number;
  ingresados: number;
  verificados: number;
  faltan: number;
  pct: number;
  pctFaltante: number;
}

export interface CifrasPorRol {
  veedores: Cifras;
  coordinadores: Cifras;
  cda: Cifras;
  // Juntas con veedor titular y coordinador titular en su recinto.
  completa: Cifras;
}

export type EstadoRecinto = "completo" | "casi" | "pendiente";

export interface FilaRecinto extends CifrasPorRol {
  codigo: number;
  parroquiaCodigo: number;
  parroquia: string;
  urbana: boolean;
  recinto: string;
  esCda: boolean;
  estado: EstadoRecinto;
}

export function cifras(
  requerido: number,
  ingresados: number,
  verificados: number,
): Cifras {
  const cobertura = pct(ingresados, requerido);
  return {
    requerido,
    ingresados,
    verificados,
    faltan: Math.max(0, requerido - ingresados),
    pct: cobertura,
    pctFaltante: requerido > 0 ? Math.round((100 - cobertura) * 10) / 10 : 0,
  };
}

type RolCifras = keyof CifrasPorRol;

// Suma las cifras de varias filas y recalcula los porcentajes con los totales,
// nunca promediando los de cada fila.
export function sumar(filas: CifrasPorRol[]): CifrasPorRol {
  const suma = (rol: RolCifras) =>
    cifras(
      filas.reduce((a, f) => a + f[rol].requerido, 0),
      filas.reduce((a, f) => a + f[rol].ingresados, 0),
      filas.reduce((a, f) => a + f[rol].verificados, 0),
    );
  return {
    veedores: suma("veedores"),
    coordinadores: suma("coordinadores"),
    cda: suma("cda"),
    completa: suma("completa"),
  };
}
