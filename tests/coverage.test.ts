import { describe, expect, it } from "vitest";
import {
  calcularCobertura,
  calcularCoberturaCanton,
  calcularCoberturaGrupo,
  calcularCoberturaPorParroquia,
  extraerPct,
  extraerPctRecinto,
  totalesDeTrack,
} from "../src/lib/gestion/coverage";
import type { ParroquiaFeature, Recinto } from "../src/lib/types";
import type { Coordinador, Veedor } from "../src/lib/gestion/types";

// Parroquia 1: R1 (juntas F1 y F2) y R2 (una junta, F1). Parroquia 2: R3 (F1).
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
  {
    cod: 3,
    par: 2,
    nombre: "R3",
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
  { properties: { code: 1, name: "P1", urbana: true, lx: 0, ly: 0 } },
  { properties: { code: 2, name: "P2", urbana: false, lx: 0, ly: 0 } },
] as ParroquiaFeature[];

const vee = (juntaId: string, verificado = false, tipo = "titular") =>
  ({ juntaId, tipo, verificado }) as Veedor;
const coord = (recintoCodigo: number, verificado = false) =>
  ({ recintoCodigo, tipo: "titular", verificado }) as Coordinador;

// Veedores en R1-F1, R2-F1 y R3-F1; coordinador solo en R2 (verificado).
const veedores = [vee("1-F1"), vee("2-F1", true), vee("3-F1")];
const coordinadores = [coord(2, true)];

describe("cobertura completa: una sola medida en todas partes", () => {
  const filas = calcularCobertura(recintos, veedores, coordinadores, []);
  const porParroquia = calcularCoberturaPorParroquia(
    parroquias,
    recintos,
    veedores,
    coordinadores,
    [],
  );
  const canton = calcularCoberturaCanton(porParroquia);

  it("una junta con veedor pero sin coordinador en su recinto no cuenta", () => {
    const r1 = filas.find((f) => f.recintoCodigo === 1)!;
    expect(r1.juntasCubiertas).toBe(0);
    expect(r1.pct).toBe(0);
  });

  it("con veedor y coordinador sí cuenta, también verificada", () => {
    const r2 = filas.find((f) => f.recintoCodigo === 2)!;
    expect(r2.juntasCubiertas).toBe(1);
    expect(r2.pct).toBe(100);
    expect(r2.juntasCubiertasVerificado).toBe(1);
  });

  it("la tabla, las parroquias y el cantón dan el mismo total de juntas cubiertas", () => {
    const sumaTabla = filas.reduce((a, f) => a + f.juntasCubiertas, 0);
    const sumaParroquias = Object.values(porParroquia).reduce(
      (a, p) => a + p.juntasCubiertas,
      0,
    );
    expect(sumaTabla).toBe(1);
    expect(sumaParroquias).toBe(sumaTabla);
    expect(canton.juntasCubiertas).toBe(sumaTabla);
    expect(canton.totalJuntas).toBe(4);
    expect(canton.pctCobertura).toBe(25);
  });

  it("el verificado también coincide entre tabla y cantón", () => {
    const sumaTabla = filas.reduce(
      (a, f) => a + f.juntasCubiertasVerificado,
      0,
    );
    expect(canton.juntasCubiertasVerificado).toBe(sumaTabla);
    expect(canton.pctCoberturaVerificada).toBe(25);
  });

  it("las gráficas del track de veedores leen esa misma medida", () => {
    expect(extraerPct("veedores", canton)).toEqual({
      pct: canton.pctCobertura,
      pctVerificado: canton.pctCoberturaVerificada,
    });
    const r1 = filas.find((f) => f.recintoCodigo === 1)!;
    expect(extraerPctRecinto("veedores", r1)).toEqual({
      pct: 0,
      pctVerificado: 0,
    });
    expect(totalesDeTrack("veedores", canton)).toEqual({
      total: 4,
      cubiertos: 1,
      verificados: 1,
    });
  });

  it("un veedor suplente no cubre la junta", () => {
    const f = calcularCobertura(
      recintos,
      [vee("2-F1", false, "suplente")],
      [coord(2)],
      [],
    ).find((x) => x.recintoCodigo === 2)!;
    expect(f.juntasCubiertas).toBe(0);
  });
});

describe("cobertura de un grupo de parroquias", () => {
  // Parroquia 1: 1 junta, cubierta (100 %). Parroquia 2: 9 juntas, ninguna
  // cubierta (0 %). Promediar los porcentajes daría 50 %; la realidad es 10 %.
  const rec = (cod: number, par: number, juntas: number) =>
    ({
      cod,
      par,
      nombre: `R${cod}`,
      cda: false,
      jf: juntas,
      jm: 0,
      fi: 1,
      ff: juntas,
      mi: 0,
      mf: 0,
    }) as Recinto;
  const rs = [rec(1, 1, 1), rec(2, 2, 9)];
  const ps = [
    { properties: { code: 1, name: "A", urbana: true, lx: 0, ly: 0 } },
    { properties: { code: 2, name: "B", urbana: true, lx: 0, ly: 0 } },
  ] as ParroquiaFeature[];
  const porParroquia = calcularCoberturaPorParroquia(
    ps,
    rs,
    [vee("1-F1", true)],
    [coord(1, true)],
    [],
  );

  it("pesa cada parroquia por sus juntas, no por igual", () => {
    const grupo = calcularCoberturaGrupo(porParroquia, [1, 2]);
    expect(grupo.totalJuntas).toBe(10);
    expect(grupo.juntasCubiertas).toBe(1);
    expect(grupo.pctCobertura).toBe(10);
    expect(grupo.pctCoberturaVerificada).toBe(10);
    // El promedio de porcentajes (el error que había) daría 50.
    const promedio =
      (porParroquia[1].pctCobertura + porParroquia[2].pctCobertura) / 2;
    expect(promedio).toBe(50);
    expect(grupo.pctCobertura).not.toBe(promedio);
  });

  it("el coordinador también se pesa por recintos, y sus verificados", () => {
    const grupo = calcularCoberturaGrupo(porParroquia, [1, 2]);
    expect(grupo.totalRecintos).toBe(2);
    expect(grupo.recintosConCoordinador).toBe(1);
    expect(grupo.pctCoordinador).toBe(50);
    expect(grupo.pctCoordinadorVerificado).toBe(50);
  });

  it("un grupo de una sola parroquia coincide con esa parroquia", () => {
    const g = calcularCoberturaGrupo(porParroquia, [2]);
    expect(g.pctCobertura).toBe(porParroquia[2].pctCobertura);
    expect(g.totalJuntas).toBe(9);
  });

  it("ignora códigos sin datos y un grupo vacío da 0 sin romper", () => {
    expect(calcularCoberturaGrupo(porParroquia, [99]).pctCobertura).toBe(0);
    expect(calcularCoberturaGrupo(porParroquia, []).totalJuntas).toBe(0);
  });
});
