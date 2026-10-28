import { describe, expect, it } from "vitest";
import {
  agruparPorRecinto,
  filasListado,
  juntaCorta,
} from "../src/lib/gestion/listado";
import type { ParroquiaBasica, Recinto } from "../src/lib/types";
import type {
  AcreditadoCda,
  Coordinador,
  Veedor,
} from "../src/lib/gestion/types";

describe("juntaCorta", () => {
  it("pone el número antes del género", () => {
    expect(juntaCorta("354-M15")).toBe("15M");
    expect(juntaCorta("F1")).toBe("1F");
  });
});

describe("filasListado y agruparPorRecinto", () => {
  const recintos = [
    { cod: 1, par: 10, nombre: "ESCUELA RURAL" },
    { cod: 2, par: 20, nombre: "COLEGIO URBANO" },
  ] as Recinto[];
  const parroquias = [
    { properties: { code: 10, name: "Toacaso", urbana: false } },
    { properties: { code: 20, name: "La Matriz", urbana: true } },
  ] as ParroquiaBasica[];
  const persona = (extra: object) => ({
    cedula: "0503451163 ",
    nombres: "PÉREZ ANA",
    telefono: "0987654321",
    tipo: "titular",
    recintoCodigo: 2,
    ...extra,
  });
  const filas = filasListado({
    recintos,
    parroquias,
    veedores: [
      persona({ nombres: "V10", juntaId: "2-M10" }),
      persona({ nombres: "V2S", juntaId: "2-F2", tipo: "suplente" }),
      persona({ nombres: "V2", juntaId: "2-F2" }),
      persona({ nombres: "VR", juntaId: "1-M1", recintoCodigo: 1 }),
    ] as Veedor[],
    coordinadores: [persona({ nombres: "C" })] as Coordinador[],
    acreditados: [persona({ nombres: "A" })] as AcreditadoCda[],
  });

  it("una fila por puesto, con recinto, parroquia, dignidad y junta", () => {
    expect(filas).toHaveLength(6);
    expect(filas.find((f) => f.nombres === "V10")).toMatchObject({
      cedula: "0503451163",
      dignidad: "Veedor",
      junta: "10M",
      recinto: "COLEGIO URBANO",
      parroquia: "La Matriz",
      urbana: true,
    });
    expect(filas.find((f) => f.nombres === "C")?.junta).toBeNull();
  });

  it("urbanas primero; dentro del recinto, dignidad y junta en orden", () => {
    const grupos = agruparPorRecinto(filas);
    expect(grupos.map((g) => g.recinto)).toEqual([
      "COLEGIO URBANO",
      "ESCUELA RURAL",
    ]);
    expect(grupos[0].filas.map((f) => f.nombres)).toEqual([
      "C",
      "A",
      "V2",
      "V2S",
      "V10",
    ]);
  });

  it("con conPorCubrir suma una fila vacía por puesto titular sin cubrir", () => {
    const conRango = [
      { ...recintos[0], cda: true, jf: 1, fi: 1, ff: 1, jm: 1, mi: 1, mf: 1 },
      { ...recintos[1], cda: false, jf: 1, fi: 2, ff: 2, jm: 1, mi: 10, mf: 10 },
    ] as Recinto[];
    const vacias = filasListado({
      recintos: conRango,
      parroquias,
      veedores: [
        persona({ nombres: "V10", juntaId: "2-M10" }),
        persona({ nombres: "V2S", juntaId: "2-F2", tipo: "suplente" }),
        persona({ nombres: "VR", juntaId: "1-M1", recintoCodigo: 1 }),
      ] as Veedor[],
      coordinadores: [persona({ nombres: "C" })] as Coordinador[],
      acreditados: [],
      conPorCubrir: true,
    }).filter((f) => f.porCubrir);
    // Recinto 1: coordinador, CDA y la 1F; recinto 2: la 2F (solo suplente).
    expect(
      vacias.map((f) => `${f.recintoCodigo} ${f.dignidad} ${f.junta ?? ""}`),
    ).toEqual([
      "1 Coordinador ",
      "1 Acreditado CDA ",
      "1 Veedor 1F",
      "2 Veedor 2F",
    ]);
    expect(vacias[0]).toMatchObject({ cedula: "", nombres: "", tipo: "titular" });
  });
});
