import type { Recinto } from "../types";
import { listJuntasDeRecinto } from "./juntas";
import type { Coordinador, CoberturaRecinto, Veedor } from "./types";

export function calcularCobertura(
  recintos: Recinto[],
  veedores: Veedor[],
  coordinadores: Coordinador[],
): CoberturaRecinto[] {
  const juntasConTitular = new Set(
    veedores.filter((v) => v.tipo === "titular").map((v) => v.juntaId),
  );
  const recintosConCoordinadorTitular = new Set(
    coordinadores
      .filter((c) => c.tipo === "titular")
      .map((c) => c.recintoCodigo),
  );

  return recintos.map((recinto) => {
    const juntas = listJuntasDeRecinto(recinto);
    const tieneCoordinadorTitular = recintosConCoordinadorTitular.has(
      recinto.cod,
    );
    const juntasCubiertas = tieneCoordinadorTitular
      ? juntas.filter((j) => juntasConTitular.has(j.id)).length
      : 0;
    return {
      recintoCodigo: recinto.cod,
      parroquiaCodigo: recinto.par,
      totalJuntas: juntas.length,
      juntasCubiertas,
      tieneCoordinadorTitular,
      pct:
        juntas.length > 0
          ? Math.round((juntasCubiertas / juntas.length) * 1000) / 10
          : 0,
    };
  });
}
