// Intenta reconocer a qué recinto se refiere el texto libre de "Preferencia"
// ("Colegio La Salle", "Unida Educativa Vicente León", "Guaytacama"...) para
// precargar Recinto y Parroquia en Militancia. Es deliberadamente
// conservador: solo devuelve un recinto cuando es el único (o claramente el
// mejor) candidato; si hay duda devuelve null y la persona elige a mano.
//
// Pura (sin node ni base de datos): sirve igual en el servidor y en el
// navegador.
import type { ParroquiaFeature, Recinto } from "../types";

// Palabras que no distinguen un recinto de otro.
const GENERICAS = [
  "unidad",
  "educativa",
  "ue",
  "u",
  "e",
  "escuela",
  "esc",
  "colegio",
  "col",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "centro",
  "latacunga",
  "bloque",
  "junta",
  "gad",
];

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let anterior = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const actual = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = actual;
    }
  }
  return fila[b.length];
}

// Igualdad que tolera una errata en palabras largas ("Unida", "Esuela").
function parecidas(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1;
}

function tokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

const esGenerica = (t: string) => GENERICAS.some((g) => parecidas(t, g));

// Mayor cantidad de palabras seguidas de la preferencia que aparecen también
// seguidas en el nombre del recinto. Desempata "Escuela Ana Páez" de
// "Escuela Manuel Salcedo", que comparten palabras sueltas.
function rachaMaxima(pref: string[], nombre: string[]): number {
  let mejor = 0;
  for (let i = 0; i < pref.length; i += 1) {
    for (let j = 0; j < nombre.length; j += 1) {
      let k = 0;
      while (
        i + k < pref.length &&
        j + k < nombre.length &&
        parecidas(pref[i + k], nombre[j + k])
      ) {
        k += 1;
      }
      mejor = Math.max(mejor, k);
    }
  }
  return mejor;
}

export function recintoDePreferencia(
  preferencia: string,
  recintos: Recinto[],
  parroquias: ParroquiaFeature[],
): Recinto | null {
  const todas = tokens(preferencia);
  const distintivas = todas.filter((t) => !esGenerica(t));
  if (distintivas.length === 0) return null;

  const candidatos = recintos.filter((r) => {
    const nombreParroquia =
      parroquias.find((p) => p.properties.code === r.par)?.properties.name ??
      "";
    const disponibles = [...tokens(r.nombre), ...tokens(nombreParroquia)];
    return distintivas.every((t) => disponibles.some((d) => parecidas(t, d)));
  });
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];

  const puntaje = candidatos
    .map((r) => ({ r, racha: rachaMaxima(todas, tokens(r.nombre)) }))
    .sort((a, b) => b.racha - a.racha);
  return puntaje[0].racha >= 2 && puntaje[0].racha > puntaje[1].racha
    ? puntaje[0].r
    : null;
}
