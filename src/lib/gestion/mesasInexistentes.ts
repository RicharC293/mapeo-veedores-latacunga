import { listJuntasDeRecinto } from "./juntas";
import type { Recinto } from "../types";

// Veedores guardados en una mesa que su recinto no tiene (o en un recinto que
// no existe). Esos registros no aparecen en ninguna pantalla ni cuentan para la
// cobertura, así que hay que avisar de ellos para poder corregirlos.
export function veedoresEnMesaInexistente<
  V extends { juntaId: string; recintoCodigo: number },
>(veedores: V[], recintos: Recinto[]): V[] {
  const mesas = new Map(
    recintos.map((r) => [
      r.cod,
      new Set(listJuntasDeRecinto(r).map((j) => j.id)),
    ]),
  );
  return veedores.filter((v) => !mesas.get(v.recintoCodigo)?.has(v.juntaId));
}
