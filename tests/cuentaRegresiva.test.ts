import { describe, expect, it } from "vitest";
import {
  ELECCIONES_INICIO,
  calcularCuentaRegresiva,
} from "../src/lib/gestion/cuentaRegresiva";

const DIA = 24 * 60 * 60 * 1000;

describe("calcularCuentaRegresiva", () => {
  it("la votación empieza el 29 de noviembre de 2026 a las 6:00 de Ecuador", () => {
    expect(new Date(ELECCIONES_INICIO).toISOString()).toBe(
      "2026-11-29T11:00:00.000Z",
    );
  });

  it("descompone el tiempo restante en días, horas y minutos", () => {
    const ahora = ELECCIONES_INICIO - (54 * DIA + 3 * 3600_000 + 12 * 60_000);
    const c = calcularCuentaRegresiva(ahora, ELECCIONES_INICIO, 0);
    expect([c.dias, c.horas, c.minutos]).toEqual([54, 3, 12]);
    expect(c.iniciada).toBe(false);
  });

  it("el ritmo es lo que falta entre los días que quedan, redondeado hacia arriba", () => {
    const ahora = ELECCIONES_INICIO - 50 * DIA;
    expect(
      calcularCuentaRegresiva(ahora, ELECCIONES_INICIO, 424).ritmoPorDia,
    ).toBe(9);
    expect(
      calcularCuentaRegresiva(ahora, ELECCIONES_INICIO, 50).ritmoPorDia,
    ).toBe(1);
  });

  it("sin personas por conseguir no hay ritmo", () => {
    const ahora = ELECCIONES_INICIO - 10 * DIA;
    expect(
      calcularCuentaRegresiva(ahora, ELECCIONES_INICIO, 0).ritmoPorDia,
    ).toBe(0);
  });

  it("con menos de un día queda 'hoy' y el ritmo es todo lo que falta", () => {
    const ahora = ELECCIONES_INICIO - 5 * 3600_000;
    const c = calcularCuentaRegresiva(ahora, ELECCIONES_INICIO, 40);
    expect(c.esHoy).toBe(true);
    expect(c.ritmoPorDia).toBe(40);
  });

  it("después de la fecha queda iniciada y sin cifras negativas", () => {
    const c = calcularCuentaRegresiva(
      ELECCIONES_INICIO + DIA,
      ELECCIONES_INICIO,
      99,
    );
    expect(c).toMatchObject({
      iniciada: true,
      dias: 0,
      horas: 0,
      minutos: 0,
      ritmoPorDia: 0,
    });
  });
});
