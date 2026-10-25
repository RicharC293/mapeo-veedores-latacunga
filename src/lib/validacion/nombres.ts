import { normalizar } from "../format";

// Partículas que no cuentan al comparar nombres ("DE LA CRUZ").
const PARTICULAS = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "e",
  "da",
  "van",
  "von",
]);

// Formato único del sistema: el nombre completo tal como lo da el Registro
// Civil, en mayúsculas y con los apellidos primero ("ORTEGA GAETE JAIME
// HERNAN"). Si la respuesta no trae el nombre completo, se arma con los
// apellidos y luego los nombres.
export function nombreOficial(
  nombres: string | null,
  apellidos: string | null,
  nombreCompleto: string | null = null,
): string {
  const base =
    nombreCompleto?.trim() ||
    [apellidos, nombres]
      .filter((p): p is string => Boolean(p?.trim()))
      .join(" ");
  return base.replace(/\s+/g, " ").trim().toLocaleUpperCase("es");
}

export type Coincidencia = "igual" | "parecido" | "distinto";

const palabras = (texto: string) =>
  normalizar(texto)
    .replace(/[^a-zñ\s-]/g, " ")
    .split(/\s+/)
    .filter((p) => p !== "" && !PARTICULAS.has(p));

// Compara el nombre registrado con el oficial sin importar mayúsculas, tildes
// ni el orden (hay registros con los apellidos primero). "igual": mismas
// palabras, solo cambia el formato. "parecido": comparten la mayoría (falta un
// segundo nombre, una letra distinta). "distinto": probablemente otra persona o
// una cédula mal digitada; hay que revisarlo.
export function compararNombres(
  registrado: string,
  oficial: string,
): Coincidencia {
  const a = palabras(registrado);
  const b = palabras(oficial);
  if (a.length === 0 || b.length === 0) return "distinto";
  const restantes = [...b];
  let comunes = 0;
  for (const p of a) {
    const i = restantes.indexOf(p);
    if (i !== -1) {
      comunes += 1;
      restantes.splice(i, 1);
    }
  }
  if (comunes === a.length && comunes === b.length) return "igual";
  const menor = Math.min(a.length, b.length);
  return comunes >= 2 && comunes / menor >= 0.6 ? "parecido" : "distinto";
}
