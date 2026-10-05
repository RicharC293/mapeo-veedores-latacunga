import type { Recinto } from "../types";
import type { Lider } from "./types";

// Quién es responsable de un recinto. Compartido por el panel del mapa y por
// el diagrama "Responsables por recinto" para que ambos den siempre la misma
// respuesta: primero los líderes con ese recinto asignado de forma explícita;
// si no hay ninguno, los líderes de parroquia cuya lista de parroquias a
// cargo incluye la del recinto.
export function responsablesDeRecinto(
  lideres: Lider[],
  recinto: Recinto,
): Lider[] {
  const especificos = lideres.filter((l) =>
    l.recintoCodigos.includes(recinto.cod),
  );
  if (especificos.length > 0) return especificos;
  return lideres.filter(
    (l) => l.ambito === "parroquia" && l.parroquiaCodigos.includes(recinto.par),
  );
}
