import type { ParroquiaBasica, Recinto } from "../types";
import type { AcreditadoCda, Coordinador, Veedor } from "./types";

// Filas de los listados para imprimir: una por puesto asignado en el
// Consolidado, con su recinto, dignidad y junta.

export type Dignidad = "Coordinador" | "Acreditado CDA" | "Veedor";

export interface FilaListado {
  cedula: string;
  nombres: string;
  telefono: string;
  dignidad: Dignidad;
  tipo: "titular" | "suplente";
  // "1M", "12F"; null para coordinadores y acreditados CDA.
  junta: string | null;
  recintoCodigo: number;
  recinto: string;
  parroquia: string;
  urbana: boolean;
}

// "354-M15" → "15M".
export function juntaCorta(juntaId: string): string {
  const etiqueta = juntaId.slice(juntaId.lastIndexOf("-") + 1);
  const m = /^([FM])(\d+)$/.exec(etiqueta);
  return m ? `${m[2]}${m[1]}` : etiqueta;
}

const ORDEN_DIGNIDAD: Record<Dignidad, number> = {
  Coordinador: 0,
  "Acreditado CDA": 1,
  Veedor: 2,
};

// Dentro de un recinto: coordinador, CDA y veedores por número de junta
// (1F, 1M, 2F…), con el titular antes que sus suplentes.
export function compararEnRecinto(a: FilaListado, b: FilaListado): number {
  const numero = (f: FilaListado) =>
    f.junta ? Number.parseInt(f.junta, 10) : 0;
  return (
    ORDEN_DIGNIDAD[a.dignidad] - ORDEN_DIGNIDAD[b.dignidad] ||
    numero(a) - numero(b) ||
    (a.junta ?? "").localeCompare(b.junta ?? "") ||
    Number(a.tipo === "suplente") - Number(b.tipo === "suplente") ||
    a.nombres.localeCompare(b.nombres, "es")
  );
}

export function filasListado(entrada: {
  recintos: Recinto[];
  parroquias: ParroquiaBasica[];
  veedores: Veedor[];
  coordinadores: Coordinador[];
  acreditados: AcreditadoCda[];
}): FilaListado[] {
  const recintoDe = new Map(entrada.recintos.map((r) => [r.cod, r]));
  const parroquiaDe = new Map(
    entrada.parroquias.map((p) => [p.properties.code, p.properties]),
  );
  const personas = [
    ...entrada.coordinadores.map((p) => ({
      p,
      dignidad: "Coordinador" as const,
      junta: null,
    })),
    ...entrada.acreditados.map((p) => ({
      p,
      dignidad: "Acreditado CDA" as const,
      junta: null,
    })),
    ...entrada.veedores.map((p) => ({
      p,
      dignidad: "Veedor" as const,
      junta: juntaCorta(p.juntaId),
    })),
  ];
  return personas.map(({ p, dignidad, junta }) => {
    const recinto = recintoDe.get(p.recintoCodigo);
    const parroquia = recinto ? parroquiaDe.get(recinto.par) : undefined;
    return {
      cedula: p.cedula.trim(),
      nombres: p.nombres.trim(),
      telefono: p.telefono.trim(),
      dignidad,
      tipo: p.tipo,
      junta,
      recintoCodigo: p.recintoCodigo,
      recinto: recinto?.nombre ?? `Recinto ${p.recintoCodigo}`,
      parroquia: parroquia?.name ?? "",
      urbana: parroquia?.urbana ?? false,
    };
  });
}

export interface RecintoListado {
  codigo: number;
  recinto: string;
  parroquia: string;
  urbana: boolean;
  filas: FilaListado[];
}

// Listado general: urbanas primero, luego por parroquia y recinto.
export function agruparPorRecinto(filas: FilaListado[]): RecintoListado[] {
  const grupos = new Map<number, RecintoListado>();
  for (const f of filas) {
    let g = grupos.get(f.recintoCodigo);
    if (!g) {
      g = {
        codigo: f.recintoCodigo,
        recinto: f.recinto,
        parroquia: f.parroquia,
        urbana: f.urbana,
        filas: [],
      };
      grupos.set(f.recintoCodigo, g);
    }
    g.filas.push(f);
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, filas: [...g.filas].sort(compararEnRecinto) }))
    .sort(
      (a, b) =>
        Number(b.urbana) - Number(a.urbana) ||
        a.parroquia.localeCompare(b.parroquia, "es") ||
        a.recinto.localeCompare(b.recinto, "es"),
    );
}
