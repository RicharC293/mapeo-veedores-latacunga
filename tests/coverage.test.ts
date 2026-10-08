import { describe, expect, it } from "vitest";
import {
  calcularCobertura,
  calcularCoberturaCanton,
  calcularCoberturaPorParroquia,
} from "../src/lib/gestion/coverage";
import type { ParroquiaFeature, Recinto } from "../src/lib/types";
import type { Coordinador, Veedor } from "../src/lib/gestion/types";

// R1 (parroquia 1): juntas F1 y F2. R2 (parroquia 1): una junta, F1.
const recintos = [
  {
    cod: 1,
    par: 1,
    nombre: "R1",
    cda: false,
    jf: 2,
    jm: 0,
    fi: 1,
    ff: 2,
    mi: 0,
    mf: 0,
  },
  {
    cod: 2,
    par: 1,
    nombre: "R2",
    cda: false,
    jf: 1,
    jm: 0,
    fi: 1,
    ff: 1,
    mi: 0,
    mf: 0,
  },
] as Recinto[];
const parroquias = [
  { properties: { code: 1, name: "P", urbana: true, lx: 0, ly: 0 } },
] as ParroquiaFeature[];

const vee = (juntaId: string, verificado = false, tipo = "titular") =>
  ({ juntaId, tipo, verificado }) as Veedor;
const coord = (recintoCodigo: number, verificado = false) =>
  ({ recintoCodigo, tipo: "titular", verificado }) as Coordinador;

describe("cobertura por recinto: dos criterios que deben poder conciliarse", () => {
  // Veedores en R1-F1 y R2-F1; coordinador solo en R2.
  const veedores = [vee("1-F1"), vee("2-F1", true)];
  const coordinadores = [coord(2, true)];
  const filas = calcularCobertura(recintos, veedores, coordinadores, []);
  const r1 = filas.find((f) => f.recintoCodigo === 1)!;
  const r2 = filas.find((f) => f.recintoCodigo === 2)!;

  it("un recinto sin coordinador tiene juntas con veedor pero ninguna completa", () => {
    expect(r1.juntasConVeedor).toBe(1);
    expect(r1.pctVeedores).toBe(50);
    expect(r1.juntasCubiertas).toBe(0);
    expect(r1.pct).toBe(0);
  });

  it("con coordinador, las juntas con veedor sí cuentan como completas", () => {
    expect(r2.juntasConVeedor).toBe(1);
    expect(r2.juntasCubiertas).toBe(1);
    expect(r2.pct).toBe(100);
    expect(r2.juntasCubiertasVerificado).toBe(1);
  });

  it("la cobertura completa nunca supera a las juntas con veedor", () => {
    for (const f of filas) {
      expect(f.juntasCubiertas).toBeLessThanOrEqual(f.juntasConVeedor);
    }
  });

  it("la suma de la tabla coincide con el total de las gráficas (cantón)", () => {
    const canton = calcularCoberturaCanton(
      calcularCoberturaPorParroquia(
        parroquias,
        recintos,
        veedores,
        coordinadores,
        [],
      ),
    );
    const sumaTabla = filas.reduce((a, f) => a + f.juntasConVeedor, 0);
    expect(sumaTabla).toBe(canton.juntasConVeedor);
    expect(sumaTabla).toBe(2);
    expect(canton.totalJuntas).toBe(3);
  });

  it("un veedor suplente no cuenta como junta con veedor", () => {
    const f = calcularCobertura(
      recintos,
      [vee("1-F1", false, "suplente")],
      [],
      [],
    ).find((x) => x.recintoCodigo === 1)!;
    expect(f.juntasConVeedor).toBe(0);
  });
});
