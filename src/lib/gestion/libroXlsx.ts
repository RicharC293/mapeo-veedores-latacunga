import { strToU8, zipSync } from "fflate";
import { ESTILOS_CDA } from "./matrizXlsx";

// Libro de Excel armado desde cero con una o más hojas de tabla simple:
// título, una línea de contexto, encabezado azul con letras blancas (el mismo
// aspecto que el archivo de acreditados CDA), filtros y encabezado fijo.

export type Celda = string | number;

export interface HojaLibro {
  // Nombre de la pestaña (Excel admite hasta 31 caracteres).
  nombre: string;
  titulo: string;
  subtitulo: string;
  encabezados: string[];
  // Ancho de cada columna, en caracteres.
  anchos: number[];
  filas: Celda[][];
}

// Estilos de ESTILOS_CDA: 1 encabezado, 2 texto con borde, 3 título,
// 4 número centrado con borde.
const ENCABEZADO = 1;
const TEXTO = 2;
const TITULO = 3;
const NUMERO = 4;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columna(i: number): string {
  let n = i + 1;
  let letras = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

function celda(ref: string, valor: Celda, estilo: number): string {
  if (typeof valor === "number") {
    return `<c r="${ref}" s="${NUMERO}"><v>${valor}</v></c>`;
  }
  return valor === ""
    ? `<c r="${ref}" s="${estilo}"/>`
    : `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`;
}

function hojaXml(h: HojaLibro): { xml: string; rango: string } {
  const ultimaColumna = columna(h.encabezados.length - 1);
  const ultima = 4 + h.filas.length;
  const rango = `A4:${ultimaColumna}${ultima}`;
  const filas = [
    `<row r="1" ht="22" customHeight="1">${celda("A1", h.titulo, TITULO)}</row>`,
    `<row r="2">${celda("A2", h.subtitulo, 0)}</row>`,
    `<row r="4" ht="32" customHeight="1">${h.encabezados
      .map((e, i) => celda(`${columna(i)}4`, e, ENCABEZADO))
      .join("")}</row>`,
    ...h.filas.map((fila, i) => {
      const r = 5 + i;
      return `<row r="${r}">${fila
        .map((v, j) => celda(`${columna(j)}${r}`, v, TEXTO))
        .join("")}</row>`;
    }),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${ultimaColumna}${ultima}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${filas.join("")}</sheetData>
<autoFilter ref="${rango}"/>
<mergeCells count="1"><mergeCell ref="A1:${ultimaColumna}1"/></mergeCells>
<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape"/>
</worksheet>`;
  return { xml, rango };
}

export function armarLibroXlsx(hojas: HojaLibro[]): Uint8Array {
  const partes = hojas.map(hojaXml);
  const rangoAbsoluto = (rango: string) =>
    rango.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2");
  const archivos: Record<string, Uint8Array> = {
    "[Content_Types].xml":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${hojas
        .map(
          (_h, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join(
          "",
        )}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas
        .map(
          (h, i) =>
            `<sheet name="${escapar(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join("")}</sheets><definedNames>${hojas
        .map(
          (h, i) =>
            `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escapar(h.nombre)}'!${rangoAbsoluto(partes[i].rango)}</definedName>`,
        )
        .join("")}</definedNames></workbook>`),
    "xl/_rels/workbook.xml.rels":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas
        .map(
          (_h, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join(
          "",
        )}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(ESTILOS_CDA),
  };
  partes.forEach((p, i) => {
    archivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(p.xml);
  });
  return zipSync(archivos, { level: 6 });
}
