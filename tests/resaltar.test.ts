import { describe, expect, it } from "vitest";
import { partirResaltado } from "../src/lib/gestion/resaltar";

const coincidencias = (texto: string, q: string) =>
  partirResaltado(texto, q)
    .filter((t) => t.coincide)
    .map((t) => t.texto);

describe("partirResaltado", () => {
  it("sin búsqueda devuelve el texto entero sin marcar", () => {
    expect(partirResaltado("Ana Pérez", "")).toEqual([
      { texto: "Ana Pérez", coincide: false },
    ]);
    expect(partirResaltado("Ana Pérez", "   ")).toHaveLength(1);
  });

  it("ignora mayúsculas y tildes pero conserva el texto original", () => {
    expect(coincidencias("JOSÉ Luis", "jose")).toEqual(["JOSÉ"]);
    expect(coincidencias("Peña", "PENA")).toEqual(["Peña"]);
  });

  it("marca todas las coincidencias y las junta con el resto del texto", () => {
    const trozos = partirResaltado("Ana María Ana", "ana");
    expect(trozos.map((t) => t.texto).join("")).toBe("Ana María Ana");
    expect(trozos.filter((t) => t.coincide)).toHaveLength(2);
  });

  it("encuentra números dentro de una cédula", () => {
    expect(partirResaltado("0503451163", "3451")).toEqual([
      { texto: "050", coincide: false },
      { texto: "3451", coincide: true },
      { texto: "163", coincide: false },
    ]);
  });

  it("sin coincidencia deja todo sin marcar", () => {
    expect(coincidencias("Ana", "zzz")).toEqual([]);
  });
});
