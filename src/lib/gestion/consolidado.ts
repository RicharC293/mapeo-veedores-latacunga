import { listJuntasDeRecinto } from "./juntas";
import type { Recinto } from "../types";
import type { AcreditadoCda, Coordinador, Junta, Veedor } from "./types";

interface ConPuesto {
  tipo: "titular" | "suplente";
  orden: number;
}

export interface Puesto<P extends ConPuesto> {
  titular: P | null;
  suplentes: P[];
}

export interface JuntaConsolidada {
  junta: Junta;
  puesto: Puesto<Veedor>;
}

// Todo lo que un recinto necesita, con quién lo cubre hoy.
export interface FilaConsolidada {
  recinto: Recinto;
  coordinador: Puesto<Coordinador>;
  // null si el recinto no es CDA: ahí no se necesita acreditado.
  cda: Puesto<AcreditadoCda> | null;
  juntas: JuntaConsolidada[];
  juntasConTitular: number;
  // Puestos titulares que faltan por cubrir, para el resumen del recinto.
  faltantes: number;
  completo: boolean;
}

function puesto<P extends ConPuesto>(personas: P[]): Puesto<P> {
  return {
    titular: personas.find((p) => p.tipo === "titular") ?? null,
    suplentes: personas
      .filter((p) => p.tipo === "suplente")
      .sort((a, b) => a.orden - b.orden),
  };
}

export function agruparPor<T>(
  items: T[],
  clave: (item: T) => string | number,
): Map<string | number, T[]> {
  const mapa = new Map<string | number, T[]>();
  for (const item of items) {
    const k = clave(item);
    const lista = mapa.get(k);
    if (lista) lista.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}

export function consolidarRecinto(
  recinto: Recinto,
  coordinadores: Coordinador[],
  acreditados: AcreditadoCda[],
  veedores: Veedor[],
): FilaConsolidada {
  const porJunta = agruparPor(veedores, (v) => v.juntaId);
  const juntas = listJuntasDeRecinto(recinto).map((junta) => ({
    junta,
    puesto: puesto(porJunta.get(junta.id) ?? []),
  }));
  const juntasConTitular = juntas.filter((j) => j.puesto.titular).length;
  const coordinador = puesto(coordinadores);
  const cda = recinto.cda ? puesto(acreditados) : null;
  const faltantes =
    (coordinador.titular ? 0 : 1) +
    (cda && !cda.titular ? 1 : 0) +
    (juntas.length - juntasConTitular);
  return {
    recinto,
    coordinador,
    cda,
    juntas,
    juntasConTitular,
    faltantes,
    completo: faltantes === 0,
  };
}
