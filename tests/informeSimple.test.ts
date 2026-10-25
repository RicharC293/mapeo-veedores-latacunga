import { describe, expect, it } from "vitest";
import { cifras } from "../src/lib/gestion/cifras";
import type { FilaRecinto } from "../src/lib/gestion/cifras";
import {
  armarInformeSimple,
  type PersonaPorReemplazar,
} from "../src/lib/gestion/informeSimple";
import {
  motivoNoApto,
  type ValidacionCedula,
} from "../src/lib/validacion/plan";

let cod = 1;
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
  codigo = cod++,
): FilaRecinto =>
  ({
    codigo,
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

  it("pone las urbanas primero y, dentro de cada grupo, donde más falta", () => {
    expect(r.parroquias.map((p) => [p.nombre, p.faltan.total])).toEqual([
      ["La Matriz", 6],
      ["Eloy Alfaro", 0],
      ["Toacaso", 4],
      ["Aláquez", 2],
    ]);
  });

  it("suma lo que falta por recinto, parroquia, zona y cantón", () => {
    const matriz = r.parroquias.find((p) => p.nombre === "La Matriz")!;
    // R-A: falta coordinador, 4 veedores y el CDA. R-B está completo.
    expect(matriz.recintos.map((x) => [x.recinto, x.faltan])).toEqual([
      ["R-A", 6],
      ["R-B", 0],
    ]);
    expect(matriz.faltan).toEqual({
      coordinadores: 1,
      veedores: 4,
      cda: 1,
      total: 6,
    });
    expect(r.urbanas.total).toBe(6);
    expect(r.rurales).toEqual({
      coordinadores: 1,
      veedores: 5,
      cda: 0,
      total: 6,
    });
    expect(r.canton.total).toBe(12);
  });

  it("el CDA es null en los recintos que no lo son y no suma faltantes", () => {
    const toacaso = r.parroquias.find((p) => p.nombre === "Toacaso")!;
    expect(toacaso.recintos[0].cda).toBeNull();
    expect(toacaso.faltan.cda).toBe(0);
  });
});

describe("armarInformeSimple: análisis verificado", () => {
  const verif = [
    fila(1, "La Matriz", true, "R-V", 6, 5, true, true, {
      veedores: 2,
      coordinador: false,
      cda: false,
    }),
  ];

  it("sin verificar cuenta a todos los ingresados", () => {
    const [v] = armarInformeSimple(verif, "noverificado").parroquias[0]
      .recintos;
    expect(v).toMatchObject({
      coordinador: true,
      veedoresTenemos: 5,
      veedoresFaltan: 1,
      cda: true,
      faltan: 1,
    });
  });

  it("verificado cuenta solo a los verificados y el resto figura como faltante", () => {
    const [v] = armarInformeSimple(verif, "verificado").parroquias[0].recintos;
    expect(v).toMatchObject({
      coordinador: false,
      veedoresTenemos: 2,
      veedoresFaltan: 4,
      cda: false,
      faltan: 6,
    });
  });
});

describe("personas por reemplazar", () => {
  const f = fila(1, "La Matriz", true, "R-R", 4, 4, true, null, undefined, 900);
  const menor: PersonaPorReemplazar = {
    recintoCodigo: 900,
    nombres: "ANA",
    cedula: "0503451163",
    rol: "veedor",
    junta: "F1",
    motivo: "Menor de edad (16 años)",
    verificado: false,
  };

  it("un titular que no puede cubrir el puesto cuenta como faltante y se lista", () => {
    const r = armarInformeSimple([f], "noverificado", [menor]);
    const rec = r.parroquias[0].recintos[0];
    expect(rec).toMatchObject({
      veedoresTenemos: 3,
      veedoresFaltan: 1,
      faltan: 1,
    });
    expect(rec.porReemplazar).toEqual([menor]);
    expect(r.porReemplazar).toBe(1);
  });

  it("en el análisis verificado solo se descuenta si estaba verificado", () => {
    const sinVerificar = armarInformeSimple([f], "verificado", [menor]);
    expect(sinVerificar.parroquias[0].recintos[0].veedoresTenemos).toBe(0);
    const coordinador = armarInformeSimple([f], "noverificado", [
      { ...menor, rol: "coordinador", junta: null },
    ]);
    expect(coordinador.parroquias[0].recintos[0]).toMatchObject({
      coordinador: false,
      faltan: 1,
    });
  });
});

describe("motivoNoApto", () => {
  const hoy = new Date(2026, 9, 25);
  const v = (extra: Partial<ValidacionCedula>) =>
    ({
      cedula: "0503451163",
      estado: "validada",
      nombreMantenido: false,
      ...extra,
    }) as ValidacionCedula;

  it("cédula inválida, no encontrada o menor de edad", () => {
    expect(motivoNoApto("0504724395", undefined, hoy)).toBe("Cédula inválida");
    expect(
      motivoNoApto("0503451163", v({ estado: "no_encontrada" }), hoy),
    ).toBe("Cédula no encontrada en el Registro Civil");
    expect(
      motivoNoApto("0503451163", v({ fechaNacimiento: "2010-03-01" }), hoy),
    ).toBe("Menor de edad (16 años)");
  });

  it("sin motivo si es mayor de edad o aún no se consultó", () => {
    expect(
      motivoNoApto("0503451163", v({ fechaNacimiento: "1990-04-18" }), hoy),
    ).toBeNull();
    expect(motivoNoApto("0503451163", undefined, hoy)).toBeNull();
  });
});
