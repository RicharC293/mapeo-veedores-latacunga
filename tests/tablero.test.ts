import { describe, expect, it } from "vitest";
import { cifras } from "../src/lib/gestion/cifras";
import type { FilaRecinto } from "../src/lib/gestion/cifras";
import {
  barras,
  cantidad,
  filtrarRecintos,
  personasDelAlcance,
  porcentaje,
  segmentos,
  type Alcance,
} from "../src/lib/gestion/tablero";

const fila = (
  codigo: number,
  parroquiaCodigo: number,
  urbana: boolean,
  v: [number, number, number], // juntas, con veedor, verificados
  c: [number, number], // coordinador ingresado, verificado
  cda: [number, number, number] | null, // requerido, ingresado, verificado
  completa: [number, number],
): FilaRecinto =>
  ({
    codigo,
    parroquiaCodigo,
    parroquia: `P${parroquiaCodigo}`,
    urbana,
    recinto: `R${codigo}`,
    esCda: cda !== null,
    estado: "pendiente",
    veedores: cifras(v[0], v[1], v[2]),
    coordinadores: cifras(1, c[0], c[1]),
    cda: cifras(cda?.[0] ?? 0, cda?.[1] ?? 0, cda?.[2] ?? 0),
    completa: cifras(v[0], completa[0], completa[1]),
  }) as FilaRecinto;

// P1 urbana: R1 (4 juntas, 3 veedores, 1 verificado, con coordinador),
//            R2 (2 juntas, 2 veedores, sin coordinador, CDA con titular).
// P2 rural:  R3 (6 juntas, 0 veedores).
const filas = [
  fila(1, 1, true, [4, 3, 1], [1, 1], null, [3, 1]),
  fila(2, 1, true, [2, 2, 2], [0, 0], [1, 1, 0], [0, 0]),
  fila(3, 2, false, [6, 0, 0], [0, 0], null, [0, 0]),
];
const todo: Alcance = { ambito: "todas", parroquia: "", recinto: "" };

describe("cantidad y porcentaje según el modo", () => {
  const c = cifras(10, 6, 2);
  it("cuenta ingresados, verificados o sin verificar", () => {
    expect(cantidad(c, "ingresados")).toBe(6);
    expect(cantidad(c, "verificados")).toBe(2);
    expect(cantidad(c, "sinverificar")).toBe(4);
  });
  it("el porcentaje es sobre lo requerido", () => {
    expect(porcentaje(c, "ingresados")).toBe(60);
    expect(porcentaje(c, "verificados")).toBe(20);
    expect(porcentaje(c, "sinverificar")).toBe(40);
    expect(porcentaje(cifras(0, 0, 0), "ingresados")).toBe(0);
  });
});

describe("filtrarRecintos", () => {
  it("filtra por urbano o rural, parroquia y recinto", () => {
    expect(filtrarRecintos(filas, todo)).toHaveLength(3);
    expect(
      filtrarRecintos(filas, { ...todo, ambito: "urbanas" }).map(
        (f) => f.codigo,
      ),
    ).toEqual([1, 2]);
    expect(
      filtrarRecintos(filas, { ...todo, ambito: "rurales" }).map(
        (f) => f.codigo,
      ),
    ).toEqual([3]);
    expect(
      filtrarRecintos(filas, { ...todo, parroquia: 1, recinto: 2 }).map(
        (f) => f.codigo,
      ),
    ).toEqual([2]);
  });
});

describe("barras", () => {
  it("veedores sin parroquia: una barra por parroquia, con los conteos reales", () => {
    const b = barras(filas, "veedores", "ingresados", todo);
    // P1: 5 de 6 (83,3 %), P2: 0 de 6.
    expect(b).toEqual([
      { etiqueta: "P1", pct: 83.3, cantidad: 5, requerido: 6 },
      { etiqueta: "P2", pct: 0, cantidad: 0, requerido: 6 },
    ]);
  });

  it("el modo verificados cuenta solo los verificados", () => {
    const b = barras(filas, "veedores", "verificados", todo);
    expect(b[0]).toMatchObject({ etiqueta: "P1", cantidad: 3, requerido: 6 });
  });

  it("con parroquia elegida desglosa por recinto", () => {
    const b = barras(
      filtrarRecintos(filas, { ...todo, parroquia: 1 }),
      "veedores",
      "ingresados",
      { ...todo, parroquia: 1 },
    );
    expect(b.map((x) => x.etiqueta)).toEqual(["R2", "R1"]);
    expect(b[0].pct).toBe(100);
  });

  it("CDA solo cuenta los recintos CDA", () => {
    const b = barras(filas, "cda", "ingresados", todo);
    expect(b).toEqual([
      { etiqueta: "P1", pct: 100, cantidad: 1, requerido: 1 },
    ]);
  });

  it("general trae una barra por rol y la cobertura completa", () => {
    const b = barras(filas, "general", "ingresados", todo);
    expect(b.map((x) => x.etiqueta)).toEqual([
      "Veedores",
      "Coordinadores",
      "Acreditados CDA",
      "Cobertura completa",
    ]);
    expect(b[3]).toMatchObject({ cantidad: 3, requerido: 12 });
  });
});

describe("segmentos y personas", () => {
  it("los dos segmentos suman lo requerido", () => {
    for (const modo of ["ingresados", "verificados", "sinverificar"] as const) {
      const s = segmentos(cifras(10, 6, 2), modo);
      expect(s[0].valor + s[1].valor).toBe(10);
    }
  });

  it("las personas del alcance siguen el modo y los recintos filtrados", () => {
    const personas = [
      { recintoCodigo: 1, verificado: true },
      { recintoCodigo: 1, verificado: false },
      { recintoCodigo: 3, verificado: true },
    ];
    const urbanas = filtrarRecintos(filas, { ...todo, ambito: "urbanas" });
    expect(personasDelAlcance(personas, urbanas, "ingresados")).toHaveLength(2);
    expect(personasDelAlcance(personas, urbanas, "verificados")).toHaveLength(
      1,
    );
    expect(personasDelAlcance(personas, urbanas, "sinverificar")).toHaveLength(
      1,
    );
  });
});
