import type { Veedor } from "./types";

// Reparto automático de veedores por género de junta. Se recorren las juntas
// del recinto de ese género en orden: primero se llenan los titulares (la
// primera junta sin titular) y, cuando todas tienen titular, se llenan los
// suplentes (la primera junta sin suplente). Pura, para probarla aparte.
export type EleccionJunta =
  | { estado: "titular"; juntaId: string }
  | { estado: "suplente"; juntaId: string; titular: string }
  | { estado: "lleno" }
  | { estado: "sin_juntas" };

export function elegirJuntaAutomatica(
  juntaIds: string[],
  veedores: Pick<Veedor, "juntaId" | "tipo" | "nombres">[],
): EleccionJunta {
  if (juntaIds.length === 0) return { estado: "sin_juntas" };

  const titularDe = new Map<string, string>();
  const conSuplente = new Set<string>();
  for (const v of veedores) {
    if (v.tipo === "titular") titularDe.set(v.juntaId, v.nombres);
    else conSuplente.add(v.juntaId);
  }

  const libre = juntaIds.find((id) => !titularDe.has(id));
  if (libre) return { estado: "titular", juntaId: libre };

  const sinSuplente = juntaIds.find((id) => !conSuplente.has(id));
  if (sinSuplente) {
    return {
      estado: "suplente",
      juntaId: sinSuplente,
      titular: titularDe.get(sinSuplente) ?? "",
    };
  }
  return { estado: "lleno" };
}
