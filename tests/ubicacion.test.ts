import { describe, expect, it } from "vitest";
import {
  agruparPorParroquia,
  coincideUbicacion,
  leerUbicacion,
} from "../src/lib/gestion/ubicacion";
import type { ParroquiaBasica, Recinto } from "../src/lib/types";

const par = (code: number, name: string, urbana: boolean): ParroquiaBasica => ({
  properties: { code, name, urbana, lx: 0, ly: 0 },
});
const urbana = par(1, "La Matriz", true);
const rural = par(2, "Aláquez", false);

const rec = (cod: number, parCod: number, nombre: string) =>
  ({ cod, par: parCod, nombre }) as Recinto;

describe("coincideUbicacion", () => {
  it("todas deja pasar cualquier parroquia, incluso una desconocida", () => {
    expect(coincideUbicacion("todas", urbana)).toBe(true);
    expect(coincideUbicacion("todas", undefined)).toBe(true);
  });

  it("urbanas y rurales se excluyen entre sí", () => {
    expect(coincideUbicacion("urbanas", urbana)).toBe(true);
    expect(coincideUbicacion("urbanas", rural)).toBe(false);
    expect(coincideUbicacion("rurales", rural)).toBe(true);
    expect(coincideUbicacion("rurales", urbana)).toBe(false);
  });

  it("una parroquia concreta solo deja pasar a esa", () => {
    expect(coincideUbicacion(2, rural)).toBe(true);
    expect(coincideUbicacion(2, urbana)).toBe(false);
    expect(coincideUbicacion(2, undefined)).toBe(false);
  });

  it("una parroquia desconocida no pasa un filtro de tipo", () => {
    expect(coincideUbicacion("urbanas", undefined)).toBe(false);
    expect(coincideUbicacion("rurales", undefined)).toBe(false);
  });
});

describe("leerUbicacion", () => {
  it("interpreta los valores del selector", () => {
    expect(leerUbicacion("")).toBe("todas");
    expect(leerUbicacion("todas")).toBe("todas");
    expect(leerUbicacion("urbanas")).toBe("urbanas");
    expect(leerUbicacion("rurales")).toBe("rurales");
    expect(leerUbicacion("5555")).toBe(5555);
    expect(leerUbicacion("basura")).toBe("todas");
  });
});

describe("agruparPorParroquia", () => {
  it("agrupa, ordena parroquias y recintos por nombre", () => {
    const items = [
      { recinto: rec(1, 1, "Zeta") },
      { recinto: rec(2, 2, "Beta") },
      { recinto: rec(3, 1, "Alfa") },
    ];
    const grupos = agruparPorParroquia(items, [urbana, rural]);
    expect(grupos.map((g) => g.parroquia?.properties.name)).toEqual([
      "Aláquez",
      "La Matriz",
    ]);
    expect(grupos[1].items.map((i) => i.recinto.nombre)).toEqual([
      "Alfa",
      "Zeta",
    ]);
  });

  it("no pierde un recinto cuya parroquia no se conoce", () => {
    const grupos = agruparPorParroquia([{ recinto: rec(1, 99, "X") }], []);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].parroquia).toBeUndefined();
  });
});
