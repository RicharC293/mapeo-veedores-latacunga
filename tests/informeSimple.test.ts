import { describe, expect, it } from "vitest";
import { cifras } from "../src/lib/gestion/cifras";
import type { FilaRecinto } from "../src/lib/gestion/cifras";
import { armarInformeSimple } from "../src/lib/gestion/informeSimple";

const fila = (
  parroquiaCodigo: number,
  parroquia: string,
  urbana: boolean,
  recinto: string,
  juntas: number,
  conVeedor: number,
  coordinador: boolean,
  cda: boolean | null,
  verificados = { veedores: 0, coordinador: false, cda: false },
): FilaRecinto =>
  ({
    codigo: Math.floor(Math.random() * 1e6),
    parroquiaCodigo,
    parroquia,
    urbana,
    recinto,
    esCda: cda !== null,
    estado: "pendiente",
    veedores: cifras(juntas, conVeedor, verificados.veedores),
    coordinadores: cifras(
      1,
      coordinador ? 1 : 0,
      verificados.coordinador ? 1 : 0,
    ),
    cda: cifras(cda === null ? 0 : 1, cda ? 1 : 0, verificados.cda ? 1 : 0),
    completa: cifras(juntas, 0, 0),
  }) as FilaRecinto;

const filas = [
  fila(2, "Toacaso", false, "R-Z", 4, 1, false, null),
  fila(1, "La Matriz", true, "R-B", 8, 8, true, true),
  fila(1, "La Matriz", true, "R-A", 6, 2, false, false),
  fila(3, "Aláquez", false, "R-C", 2, 0, true, null),
  fila(4, "Eloy Alfaro", true, "R-D", 3, 3, true, null),
];

describe("armarInformeSimple", () => {
  const r = armarInformeSimple(filas);

  it("pone las urbanas primero y cada grupo por nombre", () => {
    expect(r.map((p) => [p.nombre, p.urbana])).toEqual([
      ["Eloy Alfaro", true],
      ["La Matriz", true],
      ["Aláquez", false],
      ["Toacaso", false],
    ]);
  });

  it("ordena los recintos de cada parroquia por nombre", () => {
    const matriz = r.find((p) => p.nombre === "La Matriz")!;
    expect(matriz.recintos.map((x) => x.recinto)).toEqual(["R-A", "R-B"]);
  });

  it("indica coordinador, veedores que se tienen y que faltan, y CDA", () => {
    const matriz = r.find((p) => p.nombre === "La Matriz")!;
    expect(matriz.recintos[0]).toEqual({
      recinto: "R-A",
      coordinador: false,
      veedoresTenemos: 2,
      veedoresFaltan: 4,
      cda: false,
    });
    expect(matriz.recintos[1]).toMatchObject({
      coordinador: true,
      veedoresTenemos: 8,
      veedoresFaltan: 0,
      cda: true,
    });
  });

  it("el CDA es null en los recintos que no lo son", () => {
    const toacaso = r.find((p) => p.nombre === "Toacaso")!;
    expect(toacaso.recintos[0].cda).toBeNull();
  });
});

describe("armarInformeSimple: análisis verificado", () => {
  // R-V: 5 de 6 veedores, solo 2 verificados; coordinador y CDA sin verificar.
  const verif = [
    fila(1, "La Matriz", true, "R-V", 6, 5, true, true, {
      veedores: 2,
      coordinador: false,
      cda: false,
    }),
    fila(1, "La Matriz", true, "R-W", 4, 4, true, null, {
      veedores: 4,
      coordinador: true,
      cda: false,
    }),
  ];

  it("sin verificar cuenta a todos los ingresados", () => {
    const [v] = armarInformeSimple(verif, "noverificado")[0].recintos;
    expect(v).toMatchObject({
      coordinador: true,
      veedoresTenemos: 5,
      veedoresFaltan: 1,
      cda: true,
    });
  });

  it("verificado cuenta solo a los verificados y el resto figura como faltante", () => {
    const [v, w] = armarInformeSimple(verif, "verificado")[0].recintos;
    expect(v).toEqual({
      recinto: "R-V",
      coordinador: false,
      veedoresTenemos: 2,
      veedoresFaltan: 4,
      cda: false,
    });
    expect(w).toMatchObject({
      coordinador: true,
      veedoresTenemos: 4,
      veedoresFaltan: 0,
      cda: null,
    });
  });
});
