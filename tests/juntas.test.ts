import { describe, expect, it } from "vitest";
import {
  existeJunta,
  numeroDeMesaConservada,
  parsearJunta,
} from "../src/lib/gestion/juntas";
import type { Recinto } from "../src/lib/types";

// Recinto con 3 juntas femeninas (F1 a F3) y 2 masculinas (M1 y M2).
const recinto = {
  cod: 1560,
  par: 1,
  nombre: "R",
  cda: false,
  jf: 3,
  jm: 2,
  fi: 1,
  ff: 3,
  mi: 1,
  mf: 2,
} as Recinto;

describe("existeJunta", () => {
  it("acepta las mesas del recinto y rechaza las que no tiene", () => {
    expect(existeJunta(recinto, "F", 3)).toBe(true);
    expect(existeJunta(recinto, "M", 2)).toBe(true);
    expect(existeJunta(recinto, "F", 9)).toBe(false);
    expect(existeJunta(recinto, "M", 3)).toBe(false);
  });

  it("las mesas empiezan donde dice el recinto, no siempre en 1", () => {
    const otro = { ...recinto, fi: 21, ff: 23 } as Recinto;
    expect(existeJunta(otro, "F", 1)).toBe(false);
    expect(existeJunta(otro, "F", 22)).toBe(true);
  });
});

describe("parsearJunta", () => {
  it("separa recinto, género y número", () => {
    expect(parsearJunta("1560-F9")).toEqual({
      recinto: 1560,
      genero: "F",
      numero: 9,
    });
    expect(parsearJunta(null)).toBeNull();
    expect(parsearJunta("basura")).toBeNull();
  });
});

describe("numeroDeMesaConservada", () => {
  it("conserva la mesa solo en el mismo recinto y género", () => {
    expect(numeroDeMesaConservada("1560-F9", 1560, "F")).toBe(9);
  });

  it("en otro recinto no conserva el número: allí puede no existir", () => {
    expect(numeroDeMesaConservada("1560-F9", 406, "F")).toBeUndefined();
  });

  it("con otro género o sin recinto elegido tampoco", () => {
    expect(numeroDeMesaConservada("1560-F9", 1560, "M")).toBeUndefined();
    expect(numeroDeMesaConservada("1560-F9", "", "F")).toBeUndefined();
    expect(numeroDeMesaConservada(null, 1560, "F")).toBeUndefined();
  });
});
