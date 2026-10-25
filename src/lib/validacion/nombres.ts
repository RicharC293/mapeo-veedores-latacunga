import { normalizar } from "../format";

// Partículas que van en minúscula dentro de un nombre ("María de los Ángeles").
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

// "JUAN ANDRÉS" → "Juan Andrés"; "MARÍA DE LOS ÁNGELES" → "María de los Ángeles".
export function aTitulo(texto: string): string {
  return texto
    .trim()
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra, i) =>
      i > 0 && PARTICULAS.has(palabra)
        ? palabra
        : palabra
            .split("-")
            .map((p) => p.charAt(0).toLocaleUpperCase("es") + p.slice(1))
            .join("-"),
    )
    .join(" ");
}

// Formato único del sistema: nombres y luego apellidos, con mayúscula inicial.
export function nombreOficial(
  nombres: string | null,
  apellidos: string | null,
  nombreCompleto: string | null = null,
): string {
  const partes = [nombres, apellidos].filter((p): p is string => Boolean(p));
  return partes.length > 0
    ? aTitulo(partes.join(" "))
    : aTitulo(nombreCompleto ?? "");
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
