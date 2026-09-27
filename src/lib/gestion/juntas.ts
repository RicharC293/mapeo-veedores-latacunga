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

export function listTodasLasJuntas(recintos: Recinto[]): Junta[] {
  return recintos.flatMap(listJuntasDeRecinto);
}

export function parseRecintoCodigoDeJuntaId(id: string): number {
  return Number(id.slice(0, id.lastIndexOf("-")));
}
