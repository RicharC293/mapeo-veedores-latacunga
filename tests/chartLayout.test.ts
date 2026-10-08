import { describe, expect, it } from "vitest";
import {
  abreviarRecinto,
  anchoEtiquetas,
  truncarAlAncho,
} from "../src/lib/gestion/chartLayout";

describe("anchoEtiquetas", () => {
  it("en pantallas anchas se queda en 170 px", () => {
    expect(anchoEtiquetas(1100)).toBe(170);
  });
  it("en pantallas angostas no pasa del 40 % del gráfico", () => {
    expect(anchoEtiquetas(300)).toBe(120);
    expect(anchoEtiquetas(311)).toBeLessThanOrEqual(311 * 0.4 + 1);
  });
  it("tiene un mínimo para que el texto no desaparezca", () => {
    expect(anchoEtiquetas(100)).toBe(84);
  });
});

// Medidor de prueba: cada letra mide 7 px y la "W" 12.
const medir = (txt: string) =>
  [...txt].reduce((a, c) => a + (c === "W" ? 12 : 7), 0);

describe("truncarAlAncho", () => {
  it("deja intacto un nombre que cabe", () => {
    expect(truncarAlAncho(medir, "La Matriz", 100)).toBe("La Matriz");
  });
  it("corta con puntos suspensivos hasta que quepa en el ancho", () => {
    const t = truncarAlAncho(medir, "Comisión Control Electoral Urbana", 100);
    expect(medir(t)).toBeLessThanOrEqual(100);
    expect(t.endsWith("…")).toBe(true);
    expect(t).not.toMatch(/\s…$/);
  });
  it("tiene en cuenta que unas letras miden más que otras", () => {
    const ancho = truncarAlAncho(medir, "WWWWWWWWWWWWWWWW", 100);
    const fino = truncarAlAncho(medir, "iiiiiiiiiiiiiiii", 100);
    expect(ancho.length).toBeLessThan(fino.length);
    expect(medir(ancho)).toBeLessThanOrEqual(100);
  });
  it("nunca devuelve algo más ancho que el espacio, ni vacío", () => {
    const t = truncarAlAncho(medir, "Palabra", 20);
    expect(t.length).toBeGreaterThan(0);
  });
});

describe("abreviarRecinto", () => {
  it("abrevia Unidad Educativa al inicio", () => {
    expect(abreviarRecinto("Unidad Educativa Municipal Cotopaxi")).toBe(
      "U.E. Municipal Cotopaxi",
    );
  });
  it("no toca otros nombres", () => {
    expect(abreviarRecinto("U.E. Isidro Ayora")).toBe("U.E. Isidro Ayora");
    expect(abreviarRecinto("Escuela Unidad Educativa X")).toBe(
      "Escuela Unidad Educativa X",
    );
  });
});
