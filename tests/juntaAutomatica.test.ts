import { describe, expect, it } from "vitest";
import { elegirJuntaAutomatica } from "../src/lib/gestion/juntaAutomatica";

const ids = ["10-F9", "10-F10", "10-F11"];
const v = (juntaId: string, tipo: "titular" | "suplente", nombres = "X") => ({
  juntaId,
  tipo,
  nombres,
});

describe("elegirJuntaAutomatica", () => {
  it("sin juntas de ese género no hay dónde asignar", () => {
    expect(elegirJuntaAutomatica([], [])).toEqual({ estado: "sin_juntas" });
  });

  it("con todo libre empieza por la primera junta", () => {
    expect(elegirJuntaAutomatica(ids, [])).toEqual({
      estado: "titular",
      juntaId: "10-F9",
    });
  });

  it("va llenando titulares en orden, saltando las ocupadas", () => {
    expect(elegirJuntaAutomatica(ids, [v("10-F9", "titular")])).toEqual({
      estado: "titular",
      juntaId: "10-F10",
    });
    expect(
      elegirJuntaAutomatica(ids, [
        v("10-F9", "titular"),
        v("10-F11", "titular"),
      ]),
    ).toEqual({ estado: "titular", juntaId: "10-F10" });
  });

  it("completos los titulares, asigna suplentes en orden", () => {
    const titulares = ids.map((id, i) => v(id, "titular", `T${i}`));
    expect(elegirJuntaAutomatica(ids, titulares)).toEqual({
      estado: "suplente",
      juntaId: "10-F9",
      titular: "T0",
    });
    expect(
      elegirJuntaAutomatica(ids, [...titulares, v("10-F9", "suplente")]),
    ).toEqual({ estado: "suplente", juntaId: "10-F10", titular: "T1" });
  });

  it("con titulares y suplentes completos, está lleno", () => {
    const todos = [
      ...ids.map((id) => v(id, "titular")),
      ...ids.map((id) => v(id, "suplente")),
    ];
    expect(elegirJuntaAutomatica(ids, todos)).toEqual({ estado: "lleno" });
  });

  it("ignora a los veedores de otras juntas", () => {
    expect(elegirJuntaAutomatica(ids, [v("99-F1", "titular")])).toEqual({
      estado: "titular",
      juntaId: "10-F9",
    });
  });
});
