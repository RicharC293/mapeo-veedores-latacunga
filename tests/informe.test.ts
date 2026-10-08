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
  { cedula: "m1", incorrecto: true, duplicado: false, asignado: null },
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

  it("el avance por rol usa titulares sobre lo necesario", () => {
    const porClave = Object.fromEntries(informe.roles.map((r) => [r.clave, r]));
    expect(porClave.veedores).toMatchObject({ necesarios: 5, registrados: 4 });
    expect(porClave.veedores.pct).toBe(80);
    expect(porClave.coordinadores).toMatchObject({
      necesarios: 4,
      registrados: 2,
      verificados: 1,
    });
    expect(porClave.cda).toMatchObject({ necesarios: 1, registrados: 0 });
    expect(porClave.completa.registrados).toBe(2);
  });

  it("de los veedores registrados a los cubiertos: la cuenta cierra", () => {
    const c = informe.cascada;
    expect(c.registrados).toBe(4);
    expect(c.cubiertos + c.esperandoCoordinador).toBe(c.registrados);
    expect(c.esperandoCoordinador).toBe(2);
    expect(c.recintosEsperando).toBe(1);
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

  it("cada parroquia da las mismas juntas cubiertas", () => {
    for (const p of [...informe.urbanas, ...informe.rurales]) {
      expect(p.cubiertas).toBe(porParroquia[p.codigo].juntasCubiertas);
      expect(p.juntas).toBe(porParroquia[p.codigo].totalJuntas);
      expect(p.conCoordinador).toBe(
        porParroquia[p.codigo].recintosConCoordinador,
      );
    }
  });

  it("el total y los subtotales suman lo mismo que el cantón", () => {
    expect(informe.total.cubiertas).toBe(canton.juntasCubiertas);
    expect(informe.total.pct).toBe(canton.pctCobertura);
    expect(
      informe.subtotalUrbanas.cubiertas + informe.subtotalRurales.cubiertas,
    ).toBe(informe.total.cubiertas);
    expect(informe.cobertura.cubiertas).toBe(canton.juntasCubiertas);
  });

  it("separa urbanas y rurales", () => {
    expect(informe.urbanas.map((p) => p.nombre)).toEqual(["Urbana A"]);
    expect(informe.rurales.map((p) => p.nombre)).toEqual(["Rural B"]);
    expect(informe.subtotalUrbanas.juntas).toBe(4);
    expect(informe.subtotalRurales.juntas).toBe(1);
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

describe("informe: calidad del dato y ritmo", () => {
  it("cuenta suplentes, excedentes y Militancia", () => {
    expect(informe.calidad.veedoresSuplentes).toBe(1);
    // R1 tiene 3 veedores (2 titulares y 1 suplente) para 2 juntas.
    expect(informe.calidad.recintosConExcedente).toBe(1);
    expect(informe.calidad.militancia).toEqual({
      total: 3,
      incorrectos: 1,
      duplicados: 1,
      repetidosAsignados: 1,
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

  it("el detalle por recinto trae una fila por recinto", () => {
    expect(informe.detalle).toHaveLength(4);
    const r1 = informe.detalle.find((d) => d.recinto === "R1")!;
    expect(r1).toMatchObject({
      juntas: 2,
      juntasConVeedor: 2,
      veedoresTotal: 3,
      coordinador: false,
      cubiertas: 0,
    });
  });
});
