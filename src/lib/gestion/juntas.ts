import type { Recinto } from "../types";
import type { Genero, Junta } from "./types";

export function juntaId(
  recintoCodigo: number,
  genero: Genero,
  numero: number,
): string {
  return `${recintoCodigo}-${genero}${numero}`;
}

export function listJuntasDeRecinto(recinto: Recinto): Junta[] {
  const juntas: Junta[] = [];
  for (let n = recinto.fi; n <= recinto.ff && recinto.jf > 0; n++) {
    juntas.push({
      id: juntaId(recinto.cod, "F", n),
      recintoCodigo: recinto.cod,
      genero: "F",
      numero: n,
    });
  }
  for (let n = recinto.mi; n <= recinto.mf && recinto.jm > 0; n++) {
    juntas.push({
      id: juntaId(recinto.cod, "M", n),
      recintoCodigo: recinto.cod,
      genero: "M",
      numero: n,
    });
  }
  return juntas;
}

// ¿Esa mesa existe en el recinto? Un veedor guardado en una mesa que el recinto
// no tiene no aparece en ninguna pantalla ni cuenta para la cobertura.
export function existeJunta(
  recinto: Recinto,
  genero: Genero,
  numero: number,
): boolean {
  const id = juntaId(recinto.cod, genero, numero);
  return listJuntasDeRecinto(recinto).some((j) => j.id === id);
}

// Parte el id de una junta ("1560-F9") en recinto, género y número.
export function parsearJunta(
  id: string | null,
): { recinto: number; genero: Genero; numero: number } | null {
  const m = /^(\d+)-([FM])(\d+)$/.exec(id ?? "");
  return m
    ? { recinto: Number(m[1]), genero: m[2] as Genero, numero: Number(m[3]) }
    : null;
}

// Número de mesa que se conserva al reasignar a quien regresó de un puesto de
// veedor: solo si se asigna al mismo recinto del que salió y al mismo género.
// En otro recinto ese número puede no existir, y entonces no se conserva (el
// servidor elige la siguiente junta libre).
export function numeroDeMesaConservada(
  juntaPreasignada: string | null,
  recintoCodigo: number | "",
  genero: Genero | "",
): number | undefined {
  const origen = parsearJunta(juntaPreasignada);
  return origen && origen.recinto === recintoCodigo && origen.genero === genero
    ? origen.numero
    : undefined;
}

export function listTodasLasJuntas(recintos: Recinto[]): Junta[] {
  return recintos.flatMap(listJuntasDeRecinto);
}

export function parseRecintoCodigoDeJuntaId(id: string): number {
  return Number(id.slice(0, id.lastIndexOf("-")));
}
