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
  // Recinto 1560 con mesas F1 a F3 y M1 a M2 (el del inicio del archivo).
  const otro = { ...recinto, cod: 406 } as Recinto;

  it("conserva la mesa solo en el mismo recinto y género", () => {
    expect(numeroDeMesaConservada("1560-F3", recinto, "F")).toBe(3);
  });

  it("en otro recinto no conserva el número: allí puede no existir", () => {
    expect(numeroDeMesaConservada("1560-F3", otro, "F")).toBeUndefined();
  });

  it("si la mesa guardada no existe en el recinto, tampoco se conserva", () => {
    expect(numeroDeMesaConservada("1560-F9", recinto, "F")).toBeUndefined();
  });

  it("con otro género, sin recinto elegido o sin mesa de origen tampoco", () => {
    expect(numeroDeMesaConservada("1560-F3", recinto, "M")).toBeUndefined();
    expect(numeroDeMesaConservada("1560-F3", null, "F")).toBeUndefined();
    expect(numeroDeMesaConservada("1560-F3", recinto, "")).toBeUndefined();
    expect(numeroDeMesaConservada(null, recinto, "F")).toBeUndefined();
  });
});
