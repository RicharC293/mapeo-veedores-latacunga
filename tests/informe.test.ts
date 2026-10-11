import { describe, expect, it } from "vitest";
import { armarInforme } from "../src/lib/gestion/informe";
import {
  calcularCoberturaCanton,
  calcularCoberturaPorParroquia,
} from "../src/lib/gestion/coverage";
import { ELECCIONES_INICIO } from "../src/lib/gestion/cuentaRegresiva";
import type { ParroquiaFeature, Recinto } from "../src/lib/types";
import type {
  AcreditadoCda,
  Coordinador,
  Veedor,
} from "../src/lib/gestion/types";

// Parroquia 1 (urbana): R1 con juntas F1 y F2, R2 con una, R4 CDA con una.
// Parroquia 2 (rural): R3 con una junta.
const rec = (cod: number, par: number, juntas: number, cda = false) =>
  ({
    cod,
    par,
    nombre: `R${cod}`,
    cda,
    jf: juntas,
    jm: 0,
    fi: 1,
    ff: juntas,
    mi: 0,
    mf: 0,
  }) as Recinto;
const recintos = [rec(1, 1, 2), rec(2, 1, 1), rec(3, 2, 1), rec(4, 1, 1, true)];
const parroquias = [
  { properties: { code: 1, name: "Urbana A", urbana: true, lx: 0, ly: 0 } },
  { properties: { code: 2, name: "Rural B", urbana: false, lx: 0, ly: 0 } },
] as ParroquiaFeature[];

let n = 0;
const vee = (
  juntaId: string,
  tipo: "titular" | "suplente" = "titular",
  verificado = false,
) =>
  ({
    id: `v${n++}`,
    cedula: `c${n}`,
    juntaId,
    tipo,
    verificado,
    recintoCodigo: Number(juntaId.split("-")[0]),
  }) as Veedor;
const coord = (recintoCodigo: number, verificado = false) =>
  ({
    id: `c${n++}`,
    cedula: `k${n}`,
    recintoCodigo,
    tipo: "titular",
    verificado,
  }) as Coordinador;

// R1: 2 veedores y sin coordinador. R2 y R3: veedor y coordinador.
const veedores = [
  vee("1-F1"),
  vee("1-F2"),
  vee("2-F1", "titular", true),
  vee("3-F1"),
  vee("1-F1", "suplente"),
];
const coordinadores = [coord(2, true), coord(3)];
const acreditados: AcreditadoCda[] = [];
const militantes = [
  {
    cedula: "m1",
    incorrecto: true,
    duplicado: false,
    asignado: null,
    recintoCodigo: 3,
  },
  { cedula: "m2", incorrecto: false, duplicado: true, asignado: null },
  { cedula: "k99", incorrecto: false, duplicado: false, asignado: {} },
];
const ahora = ELECCIONES_INICIO - 10 * 24 * 3_600_000;

const informe = armarInforme({
  recintos,
  parroquias,
  veedores,
  coordinadores,
  acreditados,
  militantes,
  ahora,
});

describe("informe: cifras principales", () => {
  it("cuenta las juntas cubiertas solo con coordinador en el recinto", () => {
    expect(informe.totales).toEqual({ juntas: 5, recintos: 4, recintosCda: 1 });
    expect(informe.cobertura.cubiertas).toBe(2); // R2-F1 y R3-F1
    expect(informe.cobertura.pct).toBe(40);
    expect(informe.cobertura.cubiertasVerificadas).toBe(1); // solo R2
  });

  it("cada rol trae requerido, ingresados, verificados, faltan y los dos porcentajes", () => {
    const porClave = Object.fromEntries(informe.roles.map((r) => [r.clave, r]));
    expect(porClave.veedores).toEqual({
      clave: "veedores",
      etiqueta: "Veedores",
      requerido: 5,
      ingresados: 4,
      verificados: 1,
      faltan: 1,
      pct: 80,
      pctFaltante: 20,
    });
    expect(porClave.coordinadores).toMatchObject({
      requerido: 4,
      ingresados: 2,
      verificados: 1,
      faltan: 2,
      pct: 50,
      pctFaltante: 50,
    });
    expect(porClave.cda).toMatchObject({
      requerido: 1,
      ingresados: 0,
      faltan: 1,
      pct: 0,
      pctFaltante: 100,
    });
    expect(porClave.completa).toMatchObject({ ingresados: 2, faltan: 3 });
  });

  it("el porcentaje de cobertura y el faltante siempre suman 100", () => {
    for (const r of informe.roles) {
      expect(r.pct + r.pctFaltante).toBeCloseTo(100, 5);
      expect(r.ingresados + r.faltan).toBe(r.requerido);
    }
  });
});

describe("informe: se concilia con el cálculo por parroquia y cantón", () => {
  const porParroquia = calcularCoberturaPorParroquia(
    parroquias,
    recintos,
    veedores,
    coordinadores,
    acreditados,
  );
  const canton = calcularCoberturaCanton(porParroquia);

  it("cada parroquia da las mismas juntas cubiertas y recintos con coordinador", () => {
    for (const p of [...informe.urbanas, ...informe.rurales]) {
      expect(p.completa.ingresados).toBe(
        porParroquia[p.codigo].juntasCubiertas,
      );
      expect(p.completa.requerido).toBe(porParroquia[p.codigo].totalJuntas);
      expect(p.coordinadores.ingresados).toBe(
        porParroquia[p.codigo].recintosConCoordinador,
      );
    }
  });

  it("el total y los subtotales suman lo mismo que el cantón", () => {
    expect(informe.total.completa.ingresados).toBe(canton.juntasCubiertas);
    expect(informe.total.completa.pct).toBe(canton.pctCobertura);
    for (const rol of ["veedores", "coordinadores", "cda"] as const) {
      expect(
        informe.subtotalUrbanas[rol].requerido +
          informe.subtotalRurales[rol].requerido,
      ).toBe(informe.total[rol].requerido);
      expect(
        informe.subtotalUrbanas[rol].ingresados +
          informe.subtotalRurales[rol].ingresados,
      ).toBe(informe.total[rol].ingresados);
    }
    expect(informe.cobertura.cubiertas).toBe(canton.juntasCubiertas);
  });

  it("separa urbanas y rurales", () => {
    expect(informe.urbanas.map((p) => p.nombre)).toEqual(["Urbana A"]);
    expect(informe.rurales.map((p) => p.nombre)).toEqual(["Rural B"]);
    expect(informe.subtotalRurales.veedores.requerido).toBe(1);
  });

  it("los recintos de cada parroquia suman las cifras de la parroquia", () => {
    for (const p of [...informe.urbanas, ...informe.rurales]) {
      for (const rol of [
        "veedores",
        "coordinadores",
        "cda",
        "completa",
      ] as const) {
        expect(p.recintos.reduce((a, r) => a + r[rol].requerido, 0)).toBe(
          p[rol].requerido,
        );
        expect(p.recintos.reduce((a, r) => a + r[rol].ingresados, 0)).toBe(
          p[rol].ingresados,
        );
        expect(p.recintos.reduce((a, r) => a + r[rol].verificados, 0)).toBe(
          p[rol].verificados,
        );
      }
    }
  });

  it("los porcentajes de un grupo salen de sus cifras, no de promediar", () => {
    const u = informe.urbanas[0];
    expect(u.veedores.pct).toBe(
      Math.round((u.veedores.ingresados / u.veedores.requerido) * 1000) / 10,
    );
  });
});

describe("informe: dónde actuar primero", () => {
  it("lista los recintos con veedores y sin coordinador, con la proyección", () => {
    expect(informe.acciones).toHaveLength(1);
    expect(informe.acciones[0]).toMatchObject({
      recintoCodigo: 1,
      desbloquea: 2,
      totalJuntas: 2,
      acumulado: 2,
    });
    // 2 cubiertas hoy + 2 que se desbloquean = 4 de 5.
    expect(informe.acciones[0].pctAcumulado).toBe(80);
  });

  it("ordena por las juntas que cada coordinador desbloquearía", () => {
    const mas = armarInforme({
      recintos,
      parroquias,
      veedores: [...veedores, vee("4-F1")],
      coordinadores,
      acreditados,
      militantes,
      ahora,
    });
    expect(mas.acciones.map((a) => a.desbloquea)).toEqual([2, 1]);
    expect(mas.acciones[1].acumulado).toBe(3);
  });
});

describe("informe: ritmo y Militancia", () => {
  it("cuenta las personas de Militancia", () => {
    expect(informe.militancia).toEqual({
      total: 3,
      incorrectos: 1,
      duplicados: 1,
      repetidosAsignados: 1,
      conRecinto: 1,
    });
  });

  it("el ritmo sale de los puestos que faltan y los días que quedan", () => {
    expect(informe.ritmo.puestosNecesarios).toBe(5 + 4 + 1);
    expect(informe.ritmo.faltan).toBe(
      Math.max(
        0,
        informe.ritmo.puestosNecesarios - informe.ritmo.personasUnicas,
      ),
    );
    expect(informe.ritmo.cuenta.iniciada).toBe(false);
    expect(informe.ritmo.cuenta.dias).toBe(10);
  });
});

describe("informe: detalle por recinto", () => {
  it("trae una fila por recinto con las cifras de cada rol", () => {
    expect(informe.detalle).toHaveLength(4);
    const r1 = informe.detalle.find((d) => d.recinto === "R1")!;
    expect(r1.veedores).toMatchObject({
      requerido: 2,
      ingresados: 2,
      faltan: 0,
    });
    expect(r1.coordinadores).toMatchObject({ ingresados: 0, faltan: 1 });
    expect(r1.completa.ingresados).toBe(0);
  });

  it("el CDA solo se pide en recintos CDA", () => {
    const r1 = informe.detalle.find((d) => d.recinto === "R1")!;
    const r4 = informe.detalle.find((d) => d.recinto === "R4")!;
    expect(r1.cda.requerido).toBe(0);
    expect(r4.cda).toMatchObject({ requerido: 1, ingresados: 0, faltan: 1 });
  });

  it("clasifica el estado de cada recinto", () => {
    const estado = (n: string) =>
      informe.detalle.find((d) => d.recinto === n)!.estado;
    expect(estado("R2")).toBe("completo");
    expect(estado("R3")).toBe("completo");
    expect(estado("R1")).toBe("pendiente");
    expect(estado("R4")).toBe("pendiente");
  });

  it("lista los recintos con coordinador y juntas sin veedor", () => {
    // R2 y R3 tienen coordinador pero ya todas sus juntas tienen veedor.
    expect(informe.accionesVeedores).toEqual([]);
  });
});
