import { normalizar } from "../format";

export interface Trozo {
  texto: string;
  coincide: boolean;
}

// Parte un texto en trozos, marcando los que coinciden con la búsqueda. La
// comparación ignora mayúsculas y tildes, igual que el filtro de la lista, y
// los trozos se cortan sobre el texto original (no sobre el normalizado), así
// que "jose" resalta "JOSÉ" completo.
export function partirResaltado(texto: string, consulta: string): Trozo[] {
  const q = normalizar(consulta).trim();
  if (q === "" || texto === "") return [{ texto, coincide: false }];

  // Texto normalizado carácter por carácter, recordando de dónde viene cada
  // carácter normalizado en el original.
  let normal = "";
  const desde: number[] = [];
  const hasta: number[] = [];
  let pos = 0;
  for (const ch of texto) {
    const n = normalizar(ch);
    for (let i = 0; i < n.length; i += 1) {
      desde.push(pos);
      hasta.push(pos + ch.length);
    }
    normal += n;
    pos += ch.length;
  }

  const trozos: Trozo[] = [];
  let cursor = 0;
  let desdeBusqueda = 0;
  for (;;) {
    const i = normal.indexOf(q, desdeBusqueda);
    if (i === -1) break;
    const inicio = desde[i];
    const fin = hasta[i + q.length - 1];
    if (inicio >= cursor) {
      if (inicio > cursor)
        trozos.push({ texto: texto.slice(cursor, inicio), coincide: false });
      trozos.push({ texto: texto.slice(inicio, fin), coincide: true });
      cursor = fin;
    }
    desdeBusqueda = i + q.length;
  }
  if (cursor < texto.length)
    trozos.push({ texto: texto.slice(cursor), coincide: false });
  return trozos.length > 0 ? trozos : [{ texto, coincide: false }];
}
