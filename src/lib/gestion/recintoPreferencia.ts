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
  // Frases con las que la gente cuenta dónde vota.
  "en",
  "sufraga",
  "sufrago",
  "sufragan",
  "sufragio",
  "sufragacion",
  "vota",
  "votan",
  "voto",
  "votacion",
  "lugar",
  "recinto",
  "parroquia",
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

// Igualdad que tolera erratas en palabras largas: una letra en palabras de 5+
// ("Unida", "Esuela") y dos en las de 8+ ("Semillas" por "Semillitas").
function parecidas(a: string, b: string): boolean {
  if (a === b) return true;
  const minimo = Math.min(a.length, b.length);
  if (minimo < 5) return false;
  const d = distancia(a, b);
  return d <= 1 || (minimo >= 8 && d <= 2);
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

// Las iniciales sueltas ("Luis F Vivero") tampoco distinguen nada.
const esGenerica = (t: string) =>
  t.length === 1 || GENERICAS.some((g) => parecidas(t, g));

// Prefijos institucionales que casi todos los recintos comparten ("U.E.",
// "Unidad Educativa"): no deben contar como coincidencia al desempatar, o un
// recinto que empieza igual que el texto gana sin merecerlo.
const RUIDO = ["unidad", "educativa", "ue", "u", "e"];
const esRuido = (t: string) => RUIDO.some((r) => parecidas(t, r));

// Mayor cantidad de palabras seguidas de la preferencia que aparecen también
// seguidas en el nombre del recinto. Desempata "Escuela Ana Páez" de
// "Escuela Manuel Salcedo", que comparten palabras sueltas.
function rachaMaxima(pref: string[], nombre: string[]): number {
  const p = pref.filter((t) => !esRuido(t));
  const n = nombre.filter((t) => !esRuido(t));
  let mejor = 0;
  for (let i = 0; i < p.length; i += 1) {
    for (let j = 0; j < n.length; j += 1) {
      let k = 0;
      while (
        i + k < p.length &&
        j + k < n.length &&
        parecidas(p[i + k], n[j + k])
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
