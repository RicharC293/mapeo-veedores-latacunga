import { describe, expect, it } from "vitest";
import { fmt, normalizar, rango, title } from "../src/lib/format";

describe("title", () => {
  it.each([
    [
      "U.E. MANUEL GONZALO ALBAN RUMAZO / ESC. ABDON CALDERON",
      "U.E. Manuel Gonzalo Alban Rumazo / Esc. Abdon Calderon",
    ],
    [
      "U.E. PCEI VICENTE LEÓN Y ARGUELLES / COL. VICENTE LEON DEL CENTRO",
      "U.E. PCEI Vicente León y Arguelles / Col. Vicente Leon del Centro",
    ],
    [
      "UNIDAD EDUCATIVA INTERCULTURAL BILINGUE SUMAK KAWSAY",
      "Unidad Educativa Intercultural Bilingue Sumak Kawsay",
    ],
    [
      "U. E. MARCO AURELIO SUBIA MARTINEZ BATALLA DE PANUPALI / ESC.BATALLA DE PANUPALI",
      "U.E. Marco Aurelio Subia Martinez Batalla de Panupali / Esc.Batalla de Panupali",
    ],
    ["VICENTE LEON Y ARCENTALES", "Vicente Leon y Arcentales"],
    ["AV. TAHUANTINSUYO Y CARANQUIS", "Av. Tahuantinsuyo y Caranquis"],
    ["24 DE MAYO Y DR. RAUL LEON MENDEZ", "24 de Mayo y Dr. Raul Leon Mendez"],
  ])("da formato a nombres reales del CNE: %s", (input, expected) => {
    expect(title(input)).toBe(expected);
  });
});

describe("rango", () => {
  it("muestra una sola junta cuando el inicio y el fin son iguales", () => {
    expect(rango(1, 1)).toBe("Junta 1");
  });
  it("muestra el rango cuando el inicio y el fin difieren", () => {
    expect(rango(1, 5)).toBe("Juntas 1 a 5");
  });
});

describe("fmt", () => {
  it("formatea números con separador de miles en es-EC", () => {
    expect(fmt(167527)).toBe("167.527");
  });
});

describe("normalizar", () => {
  it("quita tildes y pasa a minúsculas", () => {
    expect(normalizar("Latacunga Sur, Cotopaxí")).toBe(
      "latacunga sur, cotopaxi",
    );
  });
  it("permite comparar sin importar mayúsculas ni tildes", () => {
    expect(normalizar("PANUPALÍ")).toBe(normalizar("panupali"));
  });
});
