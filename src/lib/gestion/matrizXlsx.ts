import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { normalizar } from "../format";
import type { ParroquiaBasica, Recinto } from "../types";
import type { AcreditadoCda, Coordinador, Veedor } from "./types";

// Llena la plantilla "Matriz Veedores 2027 JRV CNE" (una hoja por parroquia,
// con la tabla de coordinadores por recinto y la de veedores por junta) con
// los datos de la base, y arma el archivo aparte de acreditados CDA. La
// plantilla se edita celda por celda dentro del propio .xlsx, sin
// reescribirla, para que conserve su formato, sus celdas combinadas, el
// formato condicional de cédulas repetidas y las fórmulas de "Verificado".

export interface DatosMatriz {
  recintos: Recinto[];
  parroquias: ParroquiaBasica[];
  veedores: Veedor[];
  coordinadores: Coordinador[];
  acreditados: AcreditadoCda[];
}

export type AlcanceMatriz = "todo" | "veedores" | "coordinadores";

export interface ResumenMatriz {
  coordinadoresLlenados: number;
  veedoresLlenados: number;
  // Filas de la plantilla que no se pudieron emparejar con un recinto o una
  // junta de la base (no debería haber ninguna).
  filasSinCoincidencia: number;
  // Celdas que la plantilla no trae y que por eso no se pudieron escribir.
  celdasFaltantes: number;
}

// Hojas que no son de parroquia: no se tocan.
const HOJAS_DE_CONTROL = new Set([
  "Índice",
  "Verificado",
  "Notas",
  "Historial_Ediciones",
  "Historial_Accesos",
]);

const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodificar(texto: string): string {
  return texto
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTIDADES[m])
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n: string) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leerCadenas(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) =>
    decodificar(
      [...(m[1] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((t) => t[1])
        .join(""),
    ),
  );
}

type FilaLeida = Map<string, string>;

// Texto de cada celda de la hoja, por fila y columna (solo las que tienen
// valor).
function leerFilas(xml: string, cadenas: string[]): Map<number, FilaLeida> {
  const filas = new Map<number, FilaLeida>();
  for (const fila of xml.matchAll(
    /<row [^>]*?\br="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g,
  )) {
    const celdas: FilaLeida = new Map();
    for (const c of (fila[2] ?? "").matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const valor = /<v>([\s\S]*?)<\/v>/.exec(c[3] ?? "")?.[1];
      const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[3] ?? "")?.[1];
      if (/\bt="s"/.test(c[2]) && valor !== undefined) {
        celdas.set(c[1], cadenas[Number(valor)] ?? "");
      } else if (inline !== undefined) {
        celdas.set(c[1], decodificar(inline));
      } else if (valor !== undefined) {
        celdas.set(c[1], decodificar(valor));
      }
    }
    filas.set(Number(fila[1]), celdas);
  }
  return filas;
}

// Hojas del libro: nombre → ruta del archivo dentro del .xlsx.
function leerHojas(
  workbookXml: string,
  relsXml: string,
): { nombre: string; ruta: string }[] {
  const destinos = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const destino = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && destino) destinos.set(id, destino);
  }
  const hojas: { nombre: string; ruta: string }[] = [];
  for (const m of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const nombre = /\bname="([^"]*)"/.exec(m[0])?.[1];
    const id = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    const destino = id ? destinos.get(id) : undefined;
    if (nombre && destino) {
      hojas.push({
        nombre: decodificar(nombre),
        ruta: `xl/${destino.replace(/^\/?(?:xl\/)?/, "")}`,
      });
    }
  }
  return hojas;
}

// Escribe un texto en una celda que ya existe en la plantilla, conservando su
// estilo. Va como texto (no número) para no perder el cero inicial de las
// cédulas y los celulares.
function escribirCelda(
  xml: string,
  ref: string,
  texto: string,
): { xml: string; escrita: boolean } {
  const patron = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = patron.exec(xml);
  if (!m) return { xml, escrita: false };
  const estilo = /\bs="(\d+)"/.exec(m[1])?.[1];
  const nueva = `<c r="${ref}"${estilo ? ` s="${estilo}"` : ""} t="inlineStr"><is><t xml:space="preserve">${escapar(texto)}</t></is></c>`;
  return {
    xml: xml.slice(0, m.index) + nueva + xml.slice(m.index + m[0].length),
    escrita: true,
  };
}

interface Persona {
  nombres: string;
  cedula: string;
  telefono: string;
}

// Los suplentes no tienen casilla propia en la plantilla: van en la columna
// de observaciones, con su cédula y celular.
function textoSuplentes(suplentes: Persona[]): string {
  return suplentes
    .map(
      (s) =>
        `Suplente: ${s.nombres} (CI ${s.cedula}${s.telefono ? `, cel. ${s.telefono}` : ""})`,
    )
    .join("; ");
}

function ordenPorOrden<T extends { orden: number }>(a: T, b: T): number {
  return a.orden - b.orden;
}

export function llenarMatriz(
  plantilla: Uint8Array,
  datos: DatosMatriz,
  alcance: AlcanceMatriz,
): { archivo: Uint8Array; resumen: ResumenMatriz } {
  const archivos = unzipSync(plantilla);
  const cadenas = leerCadenas(strFromU8(archivos["xl/sharedStrings.xml"]));
  const hojas = leerHojas(
    strFromU8(archivos["xl/workbook.xml"]),
    strFromU8(archivos["xl/_rels/workbook.xml.rels"]),
  );

  const resumen: ResumenMatriz = {
    coordinadoresLlenados: 0,
    veedoresLlenados: 0,
    filasSinCoincidencia: 0,
    celdasFaltantes: 0,
  };

  // Recintos por nombre (sin tildes ni mayúsculas) y personas por puesto.
  const recintosPorNombre = new Map<string, Recinto[]>();
  for (const r of datos.recintos) {
    const k = normalizar(r.nombre)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    recintosPorNombre.set(k, [...(recintosPorNombre.get(k) ?? []), r]);
  }
  const claveNombre = (nombre: string) =>
    normalizar(nombre)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const titularVeedor = new Map<string, Veedor>();
  const suplentesVeedor = new Map<string, Veedor[]>();
  for (const v of datos.veedores) {
    if (v.tipo === "titular") {
      if (!titularVeedor.has(v.juntaId)) titularVeedor.set(v.juntaId, v);
    } else {
      suplentesVeedor.set(v.juntaId, [
        ...(suplentesVeedor.get(v.juntaId) ?? []),
        v,
      ]);
    }
  }
  const titularCoord = new Map<number, Coordinador>();
  const suplentesCoord = new Map<number, Coordinador[]>();
  for (const c of datos.coordinadores) {
    if (c.tipo === "titular") {
      if (!titularCoord.has(c.recintoCodigo))
        titularCoord.set(c.recintoCodigo, c);
    } else {
      suplentesCoord.set(c.recintoCodigo, [
        ...(suplentesCoord.get(c.recintoCodigo) ?? []),
        c,
      ]);
    }
  }

  for (const hoja of hojas) {
    if (HOJAS_DE_CONTROL.has(hoja.nombre) || !archivos[hoja.ruta]) continue;
    let xml = strFromU8(archivos[hoja.ruta]);
    const filas = leerFilas(xml, cadenas);
    const numeros = [...filas.keys()].sort((a, b) => a - b);

    type Seccion = "coord" | "veedor" | null;
    let seccion: Seccion = null;
    let columnas: Record<string, string> = {};
    const ediciones = new Map<string, string>();

    for (const n of numeros) {
      const fila = filas.get(n)!;
      const a = fila.get("A") ?? "";

      // Encabezados: dicen en qué columna va cada dato.
      const encabezado = [...fila.entries()].find(([, t]) =>
        /^Nombre del (coordinador|veedor)$/.test(t),
      );
      if (encabezado) {
        seccion = a === "N° JRV" ? "veedor" : "coord";
        columnas = {};
        for (const [letra, texto] of fila) {
          if (/^Nombre del/.test(texto)) columnas.nombre = letra;
          else if (texto === "Cédula") columnas.cedula = letra;
          else if (texto === "Teléfono") columnas.telefono = letra;
          else if (texto === "Observaciones") columnas.obs = letra;
        }
        continue;
      }

      if (seccion === "coord") {
        if (!/^\d+$/.test(a)) {
          seccion = null;
          continue;
        }
        if (alcance === "veedores") continue;
        const recinto = recintosPorNombre.get(
          claveNombre(fila.get("B") ?? ""),
        )?.[0];
        if (!recinto) {
          resumen.filasSinCoincidencia += 1;
          continue;
        }
        const titular = titularCoord.get(recinto.cod);
        const suplentes = (suplentesCoord.get(recinto.cod) ?? []).sort(
          ordenPorOrden,
        );
        if (!titular && suplentes.length === 0) continue;
        // Un suplente sin titular no se pierde: queda en observaciones.
        if (titular) {
          ediciones.set(`${columnas.nombre}${n}`, titular.nombres);
          ediciones.set(`${columnas.cedula}${n}`, titular.cedula);
          if (titular.telefono)
            ediciones.set(`${columnas.telefono}${n}`, titular.telefono);
        }
        if (suplentes.length > 0 && columnas.obs)
          ediciones.set(`${columnas.obs}${n}`, textoSuplentes(suplentes));
        resumen.coordinadoresLlenados += 1;
      } else if (seccion === "veedor") {
        const etiqueta = /^(\d+)([FM])$/.exec(a);
        if (!etiqueta) {
          if (!a) seccion = null;
          continue;
        }
        if (alcance === "coordinadores") continue;
        const candidatos =
          recintosPorNombre.get(claveNombre(fila.get("B") ?? "")) ?? [];
        const numero = etiqueta[1];
        const juntaDe = (r: Recinto) => `${r.cod}-${etiqueta[2]}${numero}`;
        const recinto =
          candidatos.find(
            (r) =>
              titularVeedor.has(juntaDe(r)) || suplentesVeedor.has(juntaDe(r)),
          ) ??
          candidatos.find((r) => existeJunta(r, etiqueta[2], Number(numero)));
        if (!recinto) {
          resumen.filasSinCoincidencia += 1;
          continue;
        }
        const juntaId = juntaDe(recinto);
        const titular = titularVeedor.get(juntaId);
        const suplentes = (suplentesVeedor.get(juntaId) ?? []).sort(
          ordenPorOrden,
        );
        if (!titular && suplentes.length === 0) continue;
        if (titular) {
          ediciones.set(`${columnas.nombre}${n}`, titular.nombres);
          ediciones.set(`${columnas.cedula}${n}`, titular.cedula);
          if (titular.telefono)
            ediciones.set(`${columnas.telefono}${n}`, titular.telefono);
        }
        if (suplentes.length > 0 && columnas.obs)
          ediciones.set(`${columnas.obs}${n}`, textoSuplentes(suplentes));
        resumen.veedoresLlenados += 1;
      }
    }

    for (const [ref, texto] of ediciones) {
      const r = escribirCelda(xml, ref, texto);
      xml = r.xml;
      if (!r.escrita) resumen.celdasFaltantes += 1;
    }
    archivos[hoja.ruta] = strToU8(xml);
  }

  // Que Excel y Google Sheets recalculen las fórmulas de "Verificado" al
  // abrir el archivo.
  archivos["xl/workbook.xml"] = strToU8(
    strFromU8(archivos["xl/workbook.xml"]).replace(
      /<calcPr([^>]*?)\/>/,
      (m, atributos: string) =>
        /fullCalcOnLoad/.test(atributos)
          ? m
          : `<calcPr${atributos} fullCalcOnLoad="1"/>`,
    ),
  );

  return { archivo: zipSync(archivos, { level: 6 }), resumen };
}

function existeJunta(recinto: Recinto, genero: string, numero: number) {
  return genero === "F"
    ? recinto.jf > 0 && numero >= recinto.fi && numero <= recinto.ff
    : recinto.jm > 0 && numero >= recinto.mi && numero <= recinto.mf;
}

// ---------------------------------------------------------------------------
// Acreditados CDA: la plantilla no trae esta tabla, así que se arma un libro
// aparte con el mismo aspecto (encabezado azul con letras blancas).
// ---------------------------------------------------------------------------

const ESTILOS_CDA = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="10"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Arial"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor rgb="FF1F4E78"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFB7C3CF"/></left><right style="thin"><color rgb="FFB7C3CF"/></right><top style="thin"><color rgb="FFB7C3CF"/></top><bottom style="thin"><color rgb="FFB7C3CF"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
</cellXfs>
</styleSheet>`;

const ENCABEZADOS_CDA = [
  "N°",
  "Parroquia",
  "Recinto electoral",
  "Dirección",
  "N° de Juntas (JRV)",
  "N° de electores",
  "Nombre del acreditado CDA",
  "Cédula",
  "Teléfono",
  "Observaciones",
];
const ANCHOS_CDA = [6, 26, 44, 36, 12, 12, 32, 14, 14, 40];
const COLUMNAS = "ABCDEFGHIJ";

export interface FilaCda {
  parroquia: string;
  recinto: string;
  direccion: string;
  juntas: number;
  electores: number;
  nombres: string;
  cedula: string;
  telefono: string;
  observaciones: string;
}

// Una fila por recinto CDA, ordenadas por parroquia y recinto.
export function filasCda(datos: DatosMatriz): FilaCda[] {
  const parroquia = new Map(
    datos.parroquias.map((p) => [p.properties.code, p.properties.name]),
  );
  const titular = new Map<number, AcreditadoCda>();
  const suplentes = new Map<number, AcreditadoCda[]>();
  for (const a of datos.acreditados) {
    if (a.tipo === "titular") {
      if (!titular.has(a.recintoCodigo)) titular.set(a.recintoCodigo, a);
    } else {
      suplentes.set(a.recintoCodigo, [
        ...(suplentes.get(a.recintoCodigo) ?? []),
        a,
      ]);
    }
  }
  return datos.recintos
    .filter((r) => r.cda)
    .map((r) => {
      const t = titular.get(r.cod);
      return {
        parroquia: parroquia.get(r.par) ?? "",
        recinto: r.nombre,
        direccion: r.dir,
        juntas: r.jt,
        electores: r.el,
        nombres: t?.nombres ?? "",
        cedula: t?.cedula ?? "",
        telefono: t?.telefono ?? "",
        observaciones: textoSuplentes(
          (suplentes.get(r.cod) ?? []).sort(ordenPorOrden),
        ),
      };
    })
    .sort(
      (a, b) =>
        a.parroquia.localeCompare(b.parroquia, "es") ||
        a.recinto.localeCompare(b.recinto, "es"),
    );
}

function celdaTexto(ref: string, estilo: number, texto: string): string {
  return texto === ""
    ? `<c r="${ref}" s="${estilo}"/>`
    : `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(texto)}</t></is></c>`;
}

function celdaNumero(ref: string, estilo: number, n: number): string {
  return `<c r="${ref}" s="${estilo}"><v>${n}</v></c>`;
}

export function armarCdaXlsx(datos: DatosMatriz, corte: string): Uint8Array {
  const filas = filasCda(datos);
  const ultima = 4 + filas.length;
  const conAcreditado = filas.filter((f) => f.nombres).length;

  const xmlFilas: string[] = [];
  xmlFilas.push(
    `<row r="1" ht="22" customHeight="1">${celdaTexto("A1", 3, "Acreditados CDA por recinto — Cantón Latacunga")}</row>`,
  );
  xmlFilas.push(
    `<row r="2">${celdaTexto("A2", 0, `Datos al ${corte} · ${conAcreditado} de ${filas.length} recintos CDA tienen acreditado titular`)}</row>`,
  );
  xmlFilas.push(
    `<row r="4" ht="32" customHeight="1">${ENCABEZADOS_CDA.map((h, i) => celdaTexto(`${COLUMNAS[i]}4`, 1, h)).join("")}</row>`,
  );
  filas.forEach((f, i) => {
    const r = 5 + i;
    xmlFilas.push(
      `<row r="${r}">${[
        celdaNumero(`A${r}`, 4, i + 1),
        celdaTexto(`B${r}`, 2, f.parroquia),
        celdaTexto(`C${r}`, 2, f.recinto),
        celdaTexto(`D${r}`, 2, f.direccion),
        celdaNumero(`E${r}`, 4, f.juntas),
        celdaNumero(`F${r}`, 4, f.electores),
        celdaTexto(`G${r}`, 2, f.nombres),
        celdaTexto(`H${r}`, 2, f.cedula),
        celdaTexto(`I${r}`, 2, f.telefono),
        celdaTexto(`J${r}`, 2, f.observaciones),
      ].join("")}</row>`,
    );
  });

  const hoja = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:J${ultima}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${ANCHOS_CDA.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${xmlFilas.join("")}</sheetData>
<autoFilter ref="A4:J${ultima}"/>
<mergeCells count="1"><mergeCell ref="A1:J1"/></mergeCells>
<pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape"/>
</worksheet>`;

  const archivos: Record<string, Uint8Array> = {
    "[Content_Types].xml":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    "_rels/.rels":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Acreditados CDA" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'Acreditados CDA'!$A$4:$J$${ultima}</definedName></definedNames></workbook>`),
    "xl/_rels/workbook.xml.rels":
      strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(ESTILOS_CDA),
    "xl/worksheets/sheet1.xml": strToU8(hoja),
  };
  return zipSync(archivos, { level: 6 });
}
