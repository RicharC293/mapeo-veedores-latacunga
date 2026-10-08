// CSV pensado para abrirse en Excel en español: separador ";", coma decimal,
// saltos de línea CRLF y una marca BOM al inicio para que los acentos y la
// "ñ" no se estropeen.
export type Celda = string | number;

// Marca de orden de bytes (U+FEFF), escrita por código para no dejar un
// carácter invisible en el archivo.
const BOM = String.fromCharCode(0xfeff);

function escapar(celda: Celda, separador: string): string {
  const texto =
    typeof celda === "number" ? String(celda).replace(".", ",") : celda;
  return /["\r\n]/.test(texto) || texto.includes(separador)
    ? `"${texto.replace(/"/g, '""')}"`
    : texto;
}

export function aCsv(
  encabezados: string[],
  filas: Celda[][],
  separador = ";",
): string {
  const lineas = [encabezados, ...filas].map((fila) =>
    fila.map((c) => escapar(c, separador)).join(separador),
  );
  return `${BOM}${lineas.join("\r\n")}\r\n`;
}
