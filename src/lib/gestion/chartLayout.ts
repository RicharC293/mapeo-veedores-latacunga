// Medidas de los gráficos de barras horizontales (nombre a la izquierda,
// barra a la derecha). Las etiquetas del eje se dibujan en un <canvas>, que no
// parte el texto en líneas: hay que acortarlas según el ancho disponible o
// se montan sobre las barras / salen recortadas.

// Ancho reservado a las etiquetas: hasta 170 px, pero nunca más del 40 % del
// gráfico para que en pantallas angostas quede sitio para las barras.
export function anchoEtiquetas(anchoGrafica: number): number {
  return Math.round(Math.min(170, Math.max(84, anchoGrafica * 0.4)));
}

// Acorta un nombre hasta que su texto, medido de verdad con la tipografía del
// gráfico, quepa en el ancho dado. Contar caracteres no sirve: una "W" o una
// mayúscula miden bastante más que una "i".
export function truncarAlAncho(
  medir: (texto: string) => number,
  nombre: string,
  anchoPx: number,
): string {
  if (medir(nombre) <= anchoPx) return nombre;
  let n = nombre.length - 1;
  while (n > 1 && medir(`${nombre.slice(0, n).trimEnd()}…`) > anchoPx) n--;
  return `${nombre.slice(0, n).trimEnd()}…`;
}

// "Unidad Educativa Municipal X" → "U.E. Municipal X": ahorra unos 12
// caracteres y deja a la vista lo que distingue a cada recinto cuando la
// etiqueta hay que acortarla.
export function abreviarRecinto(nombre: string): string {
  return nombre.replace(/^Unidad Educativa\b/i, "U.E.");
}

// Margen que Chart.js deja entre la etiqueta y el eje.
export const MARGEN_ETIQUETA = 10;

// Espacio libre a la derecha del área de barras para el número de la
// última barra ("100%"): sin él, el rótulo se sale del lienzo y se recorta.
export const ESPACIO_ROTULO_DERECHO = 40;
