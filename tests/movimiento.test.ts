import { describe, expect, it } from "vitest";
import {
  distanciaKm,
  estadoDeJuntas,
  etiquetaJunta,
  planificarMovimiento,
  recintosCercanosSinCubrir,
  type EstadoPuestos,
  type Ocupante,
  type OcupanteVeedor,
  type Origen,
} from "../src/lib/gestion/movimiento";
import type { Recinto } from "../src/lib/types";

// Recinto 10: juntas F1, F2 y M1. Recinto 20 (CDA): F1. Recinto 30: F1.
const rec = (
  cod: number,
  par: number,
  jf: number,
  jm: number,
  extra: Partial<Recinto> = {},
) =>
  ({
    cod,
    par,
    nombre: `R${cod}`,
    cda: false,
    jf,
    jm,
    fi: 1,
    ff: jf,
    mi: 1,
    mf: jm,
    lat: 0,
    lon: 0,
    ...extra,
  }) as Recinto;

const recintos = [
  rec(10, 1, 2, 1),
  rec(20, 1, 1, 0, { cda: true, lat: 0.01 }),
  rec(30, 2, 1, 0, { lat: 0.5 }),
];

const vee = (
  id: string,
  juntaId: string,
  tipo: "titular" | "suplente",
  cedula = id,
): OcupanteVeedor => ({
  id,
  cedula,
  nombres: `N-${id}`,
  tipo,
  juntaId,
  recintoCodigo: Number(juntaId.split("-")[0]),
});
const per = (
  id: string,
  recintoCodigo: number,
  tipo: "titular" | "suplente",
): Ocupante => ({ id, cedula: id, nombres: `N-${id}`, tipo, recintoCodigo });

const vacio: EstadoPuestos = {
  veedores: [],
  coordinadores: [],
  acreditados: [],
};
const origenVeedor: Origen = {
  id: "yo",
  cedula: "yo",
  clase: "veedor",
  recintoCodigo: 10,
  juntaId: "10-F1",
};

describe("planificarMovimiento · veedor", () => {
  it("primera disponible: cubre la primera junta sin titular, sin pedir género", () => {
    const estado = {
      ...vacio,
      veedores: [vee("yo", "10-F1", "titular"), vee("a", "10-F2", "titular")],
    };
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 10, juntaId: null },
      estado,
      recintos,
    );
    expect(plan).toMatchObject({ ok: true, juntaId: "10-M1", rol: "titular" });
  });

  it("la junta de la que sale no cuenta como destino automático", () => {
    const estado = { ...vacio, veedores: [vee("yo", "10-F1", "titular")] };
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 10, juntaId: null },
      estado,
      recintos,
    );
    expect(plan).toMatchObject({ ok: true, juntaId: "10-F2" });
  });

  it("con todas las juntas con titular queda de suplente en la primera sin suplente", () => {
    const estado = {
      ...vacio,
      veedores: [
        vee("a", "20-F1", "titular"),
        vee("b", "30-F1", "titular"),
        vee("yo", "10-F1", "titular"),
      ],
    };
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 30, juntaId: null },
      estado,
      recintos,
    );
    expect(plan).toMatchObject({
      ok: true,
      juntaId: "30-F1",
      rol: "suplente",
      titular: "N-b",
    });
  });

  it("recinto completo (titular y suplente en todas): no hay cupo", () => {
    const estado = {
      ...vacio,
      veedores: [
        vee("a", "30-F1", "titular"),
        vee("b", "30-F1", "suplente"),
        vee("yo", "10-F1", "titular"),
      ],
    };
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 30, juntaId: null },
      estado,
      recintos,
    );
    expect(plan).toEqual({
      ok: false,
      motivo: "Todas las juntas de ese recinto están completas.",
    });
  });

  it("una junta concreta ocupada solo por el titular lo deja de suplente", () => {
    const estado = {
      ...vacio,
      veedores: [vee("a", "10-F2", "titular"), vee("yo", "10-F1", "titular")],
    };
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 10, juntaId: "10-F2" },
      estado,
      recintos,
    );
    expect(plan).toMatchObject({ ok: true, rol: "suplente", titular: "N-a" });
  });

  it("no se puede mover a la junta donde ya está", () => {
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 10, juntaId: "10-F1" },
      { ...vacio, veedores: [vee("yo", "10-F1", "titular")] },
      recintos,
    );
    expect(plan.ok).toBe(false);
  });

  it("rechaza una junta de otro recinto", () => {
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 10, juntaId: "30-F1" },
      vacio,
      recintos,
    );
    expect(plan.ok).toBe(false);
  });
});

describe("planificarMovimiento · coordinador y CDA", () => {
  it("de veedor a coordinador en el mismo recinto es un cambio válido", () => {
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "coordinador", recintoCodigo: 10, juntaId: null },
      { ...vacio, veedores: [vee("yo", "10-F1", "titular")] },
      recintos,
    );
    expect(plan).toMatchObject({
      ok: true,
      clase: "coordinador",
      juntaId: null,
      rol: "titular",
    });
  });

  it("con coordinador titular ya puesto queda de suplente", () => {
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "coordinador", recintoCodigo: 10, juntaId: null },
      { ...vacio, coordinadores: [per("c", 10, "titular")] },
      recintos,
    );
    expect(plan).toMatchObject({ ok: true, rol: "suplente", titular: "N-c" });
  });

  it("no hay cupo si el recinto ya tiene coordinador titular y suplente", () => {
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "coordinador", recintoCodigo: 10, juntaId: null },
      {
        ...vacio,
        coordinadores: [per("c", 10, "titular"), per("d", 10, "suplente")],
      },
      recintos,
    );
    expect(plan.ok).toBe(false);
  });

  it("CDA exige un recinto CDA", () => {
    const sinCda = planificarMovimiento(
      origenVeedor,
      { clase: "cda", recintoCodigo: 10, juntaId: null },
      vacio,
      recintos,
    );
    expect(sinCda.ok).toBe(false);
    const conCda = planificarMovimiento(
      origenVeedor,
      { clase: "cda", recintoCodigo: 20, juntaId: null },
      vacio,
      recintos,
    );
    expect(conCda).toMatchObject({ ok: true, clase: "cda" });
  });

  it("mover un coordinador al mismo recinto como coordinador no tiene sentido", () => {
    const origen: Origen = {
      id: "yo",
      cedula: "yo",
      clase: "coordinador",
      recintoCodigo: 10,
      juntaId: null,
    };
    const plan = planificarMovimiento(
      origen,
      { clase: "coordinador", recintoCodigo: 10, juntaId: null },
      { ...vacio, coordinadores: [per("yo", 10, "titular")] },
      recintos,
    );
    expect(plan.ok).toBe(false);
  });

  it("si la misma cédula consta en otro puesto, se bloquea antes de tocar nada", () => {
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "coordinador", recintoCodigo: 10, juntaId: null },
      {
        ...vacio,
        veedores: [vee("yo", "10-F1", "titular")],
        acreditados: [{ ...per("x", 20, "titular"), cedula: "yo" }],
      },
      recintos,
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.motivo).toContain("acreditado CDA");
  });

  it("sin recinto elegido no hay plan", () => {
    const plan = planificarMovimiento(
      origenVeedor,
      { clase: "veedor", recintoCodigo: 999, juntaId: null },
      vacio,
      recintos,
    );
    expect(plan.ok).toBe(false);
  });
});

describe("estadoDeJuntas y etiquetaJunta", () => {
  it("lista cada junta con su titular y suplente", () => {
    const estado = estadoDeJuntas(recintos[0], [
      vee("a", "10-F1", "titular"),
      vee("b", "10-F1", "suplente"),
    ]);
    expect(estado.map((e) => e.juntaId)).toEqual(["10-F1", "10-F2", "10-M1"]);
    expect(estado[0]).toEqual({
      juntaId: "10-F1",
      titular: "N-a",
      suplente: "N-b",
    });
    expect(estado[1].titular).toBeNull();
  });

  it("etiquetaJunta quita el código del recinto", () => {
    expect(etiquetaJunta("1582-F12")).toBe("F12");
  });
});

describe("recintosCercanosSinCubrir", () => {
  const todos = [
    rec(1, 1, 1, 0, { lat: 0, lon: 0 }),
    rec(2, 1, 1, 0, { lat: 0, lon: 0.2 }),
    rec(3, 2, 1, 0, { lat: 0, lon: 0.01 }),
    rec(4, 1, 1, 0, { lat: 0, lon: 0.05 }),
    rec(5, 3, 1, 0, { lat: Number.NaN, lon: Number.NaN }),
  ];

  it("primero los de la misma parroquia (de cerca a lejos) y luego el resto por cercanía", () => {
    const r = recintosCercanosSinCubrir(todos[0], todos, []);
    expect(r.map((x) => x.recinto.cod)).toEqual([4, 2, 3, 5]);
    expect(r[0].mismaParroquia).toBe(true);
    expect(r[2].mismaParroquia).toBe(false);
  });

  it("deja fuera el recinto de referencia y los que ya tienen todos sus titulares", () => {
    const r = recintosCercanosSinCubrir(todos[0], todos, [
      vee("a", "4-F1", "titular"),
    ]);
    expect(r.map((x) => x.recinto.cod)).not.toContain(1);
    expect(r.map((x) => x.recinto.cod)).not.toContain(4);
  });

  it("un suplente no cuenta como cubierta la junta", () => {
    const r = recintosCercanosSinCubrir(todos[0], todos, [
      vee("a", "4-F1", "suplente"),
    ]);
    expect(r.find((x) => x.recinto.cod === 4)?.faltan).toBe(1);
  });

  it("respeta el límite", () => {
    expect(recintosCercanosSinCubrir(todos[0], todos, [], 2)).toHaveLength(2);
  });
});

describe("distanciaKm", () => {
  it("un grado de latitud son unos 111 km", () => {
    const d = distanciaKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
  it("el mismo punto está a 0", () => {
    expect(
      distanciaKm({ lat: -0.9, lon: -78.6 }, { lat: -0.9, lon: -78.6 }),
    ).toBe(0);
  });
});
