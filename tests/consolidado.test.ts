import { describe, expect, it } from "vitest";
import { consolidarRecinto } from "../src/lib/gestion/consolidado";
import type { Recinto } from "../src/lib/types";
import type {
  AcreditadoCda,
  Coordinador,
  Veedor,
} from "../src/lib/gestion/types";

// Recinto 10 con 2 juntas femeninas (F1, F2) y 1 masculina (M1).
const recinto = (cda: boolean) =>
  ({
    cod: 10,
    par: 1,
    nombre: "R",
    cda,
    jf: 2,
    jm: 1,
    fi: 1,
    ff: 2,
    mi: 1,
    mf: 1,
  }) as Recinto;

const coord = (tipo: "titular" | "suplente", orden = 0) =>
  ({ tipo, orden, recintoCodigo: 10 }) as Coordinador;
const cdaP = (tipo: "titular" | "suplente") =>
  ({ tipo, orden: 0, recintoCodigo: 10 }) as AcreditadoCda;
const vee = (juntaId: string, tipo: "titular" | "suplente", orden = 0) =>
  ({ juntaId, tipo, orden, recintoCodigo: 10 }) as Veedor;

describe("consolidarRecinto", () => {
  it("un recinto vacío falta todo: coordinador y cada junta", () => {
    const f = consolidarRecinto(recinto(false), [], [], []);
    expect(f.juntas).toHaveLength(3);
    expect(f.faltantes).toBe(4);
    expect(f.completo).toBe(false);
    expect(f.cda).toBeNull();
  });

  it("completo cuando hay coordinador y un titular en cada junta", () => {
    const f = consolidarRecinto(
      recinto(false),
      [coord("titular")],
      [],
      [
        vee("10-F1", "titular"),
        vee("10-F2", "titular"),
        vee("10-M1", "titular"),
      ],
    );
    expect(f.juntasConTitular).toBe(3);
    expect(f.completo).toBe(true);
  });

  it("un suplente solo no cubre el puesto", () => {
    const f = consolidarRecinto(
      recinto(false),
      [coord("suplente")],
      [],
      [vee("10-F1", "suplente")],
    );
    expect(f.coordinador.titular).toBeNull();
    expect(f.coordinador.suplentes).toHaveLength(1);
    expect(f.juntasConTitular).toBe(0);
  });

  it("en un recinto CDA también falta el acreditado", () => {
    const base = [
      vee("10-F1", "titular"),
      vee("10-F2", "titular"),
      vee("10-M1", "titular"),
    ];
    const sin = consolidarRecinto(recinto(true), [coord("titular")], [], base);
    expect(sin.cda).not.toBeNull();
    expect(sin.faltantes).toBe(1);
    const con = consolidarRecinto(
      recinto(true),
      [coord("titular")],
      [cdaP("titular")],
      base,
    );
    expect(con.completo).toBe(true);
  });

  it("ordena los suplentes por su orden", () => {
    const f = consolidarRecinto(
      recinto(false),
      [coord("suplente", 2), coord("suplente", 1)],
      [],
      [],
    );
    expect(f.coordinador.suplentes.map((s) => s.orden)).toEqual([1, 2]);
  });
});
