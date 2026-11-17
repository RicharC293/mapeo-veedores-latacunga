import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  armarCdaXlsx,
  filasCda,
  llenarMatriz,
  type DatosMatriz,
} from "../src/lib/gestion/matrizXlsx";
import { listJuntasDeRecinto } from "../src/lib/gestion/juntas";
import { armarRuralXlsx } from "../src/lib/gestion/ruralXlsx";
import type { ParroquiaFeature, Recinto } from "../src/lib/types";
import type {
  AcreditadoCda,
  Coordinador,
  Veedor,
} from "../src/lib/gestion/types";

// La plantilla real y los recintos reales del cantón (49 recintos, 492 juntas).
const plantilla = new Uint8Array(
  readFileSync("src/assets/plantillas/Matriz_Veedores_2027_JRV_CNE.xlsx"),
);
const recintos = JSON.parse(
  readFileSync("data/seed/recintos.json", "utf8"),
) as Recinto[];
const parroquias = (
  JSON.parse(readFileSync("data/seed/parroquias.geojson", "utf8")) as {
    features: ParroquiaFeature[];
  }
).features.map(({ properties }) => ({ properties }));

let n = 0;
const persona = (extra: object) => ({
  id: `p${n++}`,
  cedula: `05${String(1000000 + n).padStart(8, "0")}`,
  nombres: `Persona ${n}`,
  telefono: `09${String(10000000 + n)}`,
  email: "",
  preferencia: "",
  responsableLiderId: null,
  orden: 0,
  verificado: false,
  creadoEn: "",
  ...extra,
});

function datosCompletos(): DatosMatriz {
  const veedores: Veedor[] = [];
  const coordinadores: Coordinador[] = [];
  const acreditados: AcreditadoCda[] = [];
  for (const r of recintos) {
    for (const j of listJuntasDeRecinto(r)) {
      veedores.push(
        persona({
          juntaId: j.id,
          recintoCodigo: r.cod,
          parroquiaCodigo: r.par,
          tipo: "titular",
        }) as Veedor,
      );
    }
    coordinadores.push(
      persona({
        recintoCodigo: r.cod,
        parroquiaCodigo: r.par,
        tipo: "titular",
      }) as Coordinador,
    );
    if (r.cda) {
      acreditados.push(
        persona({
          recintoCodigo: r.cod,
          parroquiaCodigo: r.par,
          tipo: "titular",
        }) as AcreditadoCda,
      );
    }
  }
  return { recintos, parroquias, veedores, coordinadores, acreditados };
}

const celda = (libro: XLSX.WorkBook, hoja: string, ref: string) =>
  libro.Sheets[hoja][ref]?.v;

describe("llenarMatriz: la plantilla real, llena", () => {
  const datos = datosCompletos();
  const { archivo, resumen } = llenarMatriz(plantilla, datos, "todo");
  const libro = XLSX.read(archivo, { type: "array" });

  it("empareja todos los recintos y juntas y escribe todas las celdas", () => {
    expect(resumen).toEqual({
      coordinadoresLlenados: 49,
      veedoresLlenados: 492,
      filasSinCoincidencia: 0,
      celdasFaltantes: 0,
    });
  });

  it("escribe al coordinador de cada recinto en su fila", () => {
    // San Buenaventura, primer recinto: fila 5, columnas F, G y H.
    const recinto = recintos.find((r) =>
      r.nombre.startsWith("ESC. DE EDUCACION BASICA NUMA POMPILIO"),
    )!;
    const c = datos.coordinadores.find((x) => x.recintoCodigo === recinto.cod)!;
    expect(celda(libro, "San Buenaventura", "F5")).toBe(c.nombres);
    expect(celda(libro, "San Buenaventura", "G5")).toBe(c.cedula);
    expect(celda(libro, "San Buenaventura", "H5")).toBe(c.telefono);
  });

  it("escribe al veedor de cada junta, con el cero inicial de la cédula", () => {
    // Fila 10 = junta 1F del primer recinto de San Buenaventura.
    const recinto = recintos.find((r) =>
      r.nombre.startsWith("ESC. DE EDUCACION BASICA NUMA POMPILIO"),
    )!;
    const v = datos.veedores.find((x) => x.juntaId === `${recinto.cod}-F1`)!;
    expect(celda(libro, "San Buenaventura", "A10")).toBe("1F");
    expect(celda(libro, "San Buenaventura", "D10")).toBe(v.nombres);
    expect(celda(libro, "San Buenaventura", "E10")).toBe(v.cedula);
    expect(String(celda(libro, "San Buenaventura", "E10"))).toMatch(/^0/);
  });

  it("conserva el formato: celdas combinadas, formato condicional y fórmulas", () => {
    const original = XLSX.read(plantilla, { type: "array", cellStyles: true });
    for (const hoja of ["San Buenaventura", "Eloy Alfaro (San Felipe)"]) {
      expect(libro.Sheets[hoja]["!merges"]?.length).toBe(
        original.Sheets[hoja]["!merges"]?.length,
      );
    }
    const zip = unzipSync(archivo);
    const origZip = unzipSync(plantilla);
    const formulas = (x: Uint8Array) =>
      (strFromU8(x).match(/<f[ >]/g) ?? []).length;
    expect(formulas(zip["xl/worksheets/sheet17.xml"])).toBe(
      formulas(origZip["xl/worksheets/sheet17.xml"]),
    );
    expect(strFromU8(zip["xl/worksheets/sheet6.xml"])).toContain(
      "<conditionalFormatting",
    );
    expect(strFromU8(zip["xl/workbook.xml"])).toContain('fullCalcOnLoad="1"');
    expect(libro.SheetNames).toEqual(original.SheetNames);
  });

  it("no toca las hojas de control", () => {
    const zip = unzipSync(archivo);
    const origZip = unzipSync(plantilla);
    for (const ruta of [
      "xl/worksheets/sheet1.xml", // Índice
      "xl/worksheets/sheet18.xml", // Notas
    ]) {
      expect(strFromU8(zip[ruta])).toBe(strFromU8(origZip[ruta]));
    }
  });
});

describe("llenarMatriz: alcance y suplentes", () => {
  const datos = datosCompletos();

  it("solo veedores deja los coordinadores en blanco", () => {
    const { archivo, resumen } = llenarMatriz(plantilla, datos, "veedores");
    const libro = XLSX.read(archivo, { type: "array" });
    expect(resumen.coordinadoresLlenados).toBe(0);
    expect(resumen.veedoresLlenados).toBe(492);
    expect(celda(libro, "San Buenaventura", "F5")).toBeUndefined();
    expect(celda(libro, "San Buenaventura", "D10")).toBeDefined();
  });

  it("solo coordinadores deja las juntas en blanco", () => {
    const { archivo, resumen } = llenarMatriz(
      plantilla,
      datos,
      "coordinadores",
    );
    const libro = XLSX.read(archivo, { type: "array" });
    expect(resumen.veedoresLlenados).toBe(0);
    expect(resumen.coordinadoresLlenados).toBe(49);
    expect(celda(libro, "San Buenaventura", "F5")).toBeDefined();
    expect(celda(libro, "San Buenaventura", "D10")).toBeUndefined();
  });

  it("deja en blanco lo que no tiene persona y no inventa nada", () => {
    const vacios = { ...datos, veedores: [], coordinadores: [] };
    const { archivo, resumen } = llenarMatriz(plantilla, vacios, "todo");
    const libro = XLSX.read(archivo, { type: "array" });
    expect(resumen.veedoresLlenados).toBe(0);
    expect(celda(libro, "San Buenaventura", "D10")).toBeUndefined();
  });

  it("un suplente en una junta sin titular no se pierde", () => {
    const recinto = recintos.find((r) =>
      r.nombre.startsWith("ESC. DE EDUCACION BASICA NUMA POMPILIO"),
    )!;
    const suplente = persona({
      juntaId: `${recinto.cod}-F1`,
      recintoCodigo: recinto.cod,
      parroquiaCodigo: recinto.par,
      tipo: "suplente",
      orden: 1,
      nombres: "Solo Suplente",
    }) as Veedor;
    const { archivo } = llenarMatriz(
      plantilla,
      { ...datos, veedores: [suplente] },
      "veedores",
    );
    const libro = XLSX.read(archivo, { type: "array" });
    expect(celda(libro, "San Buenaventura", "D10")).toBeUndefined();
    expect(String(celda(libro, "San Buenaventura", "G10"))).toContain(
      "Solo Suplente",
    );
  });

  it("pone a los suplentes en observaciones, con su cédula y celular", () => {
    const recinto = recintos.find((r) =>
      r.nombre.startsWith("ESC. DE EDUCACION BASICA NUMA POMPILIO"),
    )!;
    const suplente = persona({
      juntaId: `${recinto.cod}-F1`,
      recintoCodigo: recinto.cod,
      parroquiaCodigo: recinto.par,
      tipo: "suplente",
      orden: 1,
      nombres: "Ana & Luis <Suplentes>",
    }) as Veedor;
    const { archivo } = llenarMatriz(
      plantilla,
      { ...datos, veedores: [...datos.veedores, suplente] },
      "veedores",
    );
    const libro = XLSX.read(archivo, { type: "array" });
    const obs = String(celda(libro, "San Buenaventura", "G10"));
    expect(obs).toContain("Suplente: Ana & Luis <Suplentes>");
    expect(obs).toContain(`CI ${suplente.cedula}`);
  });
});

describe("armarCdaXlsx", () => {
  const datos = datosCompletos();
  const libro = XLSX.read(armarCdaXlsx(datos, "8 de octubre de 2026"), {
    type: "array",
  });
  const filas = XLSX.utils.sheet_to_json<string[]>(
    libro.Sheets["Acreditados CDA"],
    { header: 1, defval: "" },
  );

  it("trae una fila por recinto CDA, con su encabezado", () => {
    expect(libro.SheetNames).toEqual(["Acreditados CDA"]);
    expect(filas[3][6]).toBe("Nombre del acreditado CDA");
    expect(filas.length - 4).toBe(recintos.filter((r) => r.cda).length);
    expect(filasCda(datos)).toHaveLength(19);
  });

  it("escribe al acreditado titular de cada recinto", () => {
    const primera = filasCda(datos)[0];
    expect(filas[4][2]).toBe(primera.recinto);
    expect(filas[4][6]).toBe(primera.nombres);
    expect(filas[4][7]).toBe(primera.cedula);
  });

  it("sin acreditados las casillas quedan en blanco", () => {
    const sin = XLSX.read(armarCdaXlsx({ ...datos, acreditados: [] }, "hoy"), {
      type: "array",
    });
    const f = XLSX.utils.sheet_to_json<string[]>(
      sin.Sheets["Acreditados CDA"],
      {
        header: 1,
        defval: "",
      },
    );
    expect(f[4][6]).toBe("");
    expect(String(f[1][0])).toContain("0 de 19");
  });
});

describe("armarRuralXlsx: una hoja por parroquia rural", () => {
  const urbana = new Map(
    parroquias.map((p) => [p.properties.code, p.properties.urbana]),
  );
  const nombreParroquia = new Map(
    parroquias.map((p) => [p.properties.code, p.properties.name]),
  );
  const rurales = recintos.filter((r) => !urbana.get(r.par));
  const datos = datosCompletos();
  // Un recinto rural sin coordinador y con un suplente de veedor.
  const sinCoordinador = rurales[0];
  datos.coordinadores = datos.coordinadores.filter(
    (c) => c.recintoCodigo !== sinCoordinador.cod,
  );
  const juntaSuplente = listJuntasDeRecinto(sinCoordinador)[0];
  datos.veedores.push(
    persona({
      juntaId: juntaSuplente.id,
      recintoCodigo: sinCoordinador.cod,
      parroquiaCodigo: sinCoordinador.par,
      tipo: "suplente",
    }) as Veedor,
  );
  const libro = XLSX.read(armarRuralXlsx(datos, "17 de noviembre de 2026"), {
    type: "array",
  });
  const filas = (hoja: string) =>
    XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[hoja], {
      range: 3,
    });
  const parroquiasRurales = [
    ...new Set(rurales.map((r) => nombreParroquia.get(r.par)!)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  it("trae una hoja por parroquia rural, en orden alfabético", () => {
    expect(libro.SheetNames).toEqual(parroquiasRurales);
  });

  it("cada hoja trae solo los recintos de su parroquia", () => {
    for (const hoja of libro.SheetNames) {
      const propios = new Set(
        rurales
          .filter((r) => nombreParroquia.get(r.par) === hoja)
          .map((r) => r.nombre),
      );
      for (const f of filas(hoja)) {
        expect(propios.has(String(f["Recinto electoral"]))).toBe(true);
      }
    }
  });

  it("lleva coordinador, CDA y veedores de cada recinto, con los faltantes", () => {
    const todas = libro.SheetNames.flatMap(filas);
    const de = (d: string) => todas.filter((f) => f.Dignidad === d);
    expect(de("Coordinador")).toHaveLength(rurales.length);
    expect(de("Acreditado CDA")).toHaveLength(
      rurales.filter((r) => r.cda).length,
    );
    expect(de("Veedor")).toHaveLength(
      rurales.reduce((a, r) => a + r.jt, 0) + 1,
    );
    const vacia = de("Coordinador").find(
      (f) => f["Recinto electoral"] === sinCoordinador.nombre,
    )!;
    expect(vacia.Tipo).toBe("Por cubrir");
    expect(vacia.Nombres).toBeUndefined();
  });

  it("pone primero al coordinador y a cada suplente tras su titular", () => {
    const hoja = filas(nombreParroquia.get(sinCoordinador.par)!).filter(
      (f) => f["Recinto electoral"] === sinCoordinador.nombre,
    );
    expect(hoja[0].Dignidad).toBe("Coordinador");
    const i = hoja.findIndex((f) => f.Tipo === "Suplente");
    expect(hoja[i].Junta).toBe("1F");
    expect(hoja[i - 1].Junta).toBe("1F");
    expect(hoja[i - 1].Tipo).toBe("Titular");
    expect(String(hoja[i]["Cédula"])).toMatch(/^0/);
  });
});
