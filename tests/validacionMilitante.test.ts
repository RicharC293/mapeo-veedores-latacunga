import { describe, expect, it } from "vitest";
import {
  cedulaEcuatorianaValida,
  erroresMilitante,
  esIncorrecto,
} from "../src/lib/gestion/validacionMilitante";

const ok = {
  cedula: "0501831689",
  nombres: "Edgar Egas",
  telefono: "0984228153",
  email: "egas@hotmail.com",
};

describe("cedulaEcuatorianaValida", () => {
  it.each(["0501831689", "1305547364", "0502596877"])("acepta %s", (c) => {
    expect(cedulaEcuatorianaValida(c)).toBe(true);
  });
  it.each(["050235346", "0502121914", "0504068959", "", "abc"])(
    "rechaza %s",
    (c) => {
      expect(cedulaEcuatorianaValida(c)).toBe(false);
    },
  );
});

describe("erroresMilitante", () => {
  it("una persona completa no tiene errores", () => {
    expect(esIncorrecto(erroresMilitante(ok))).toBe(false);
  });
  it("exige teléfono de 10 dígitos", () => {
    expect(erroresMilitante({ ...ok, telefono: "099" }).telefono).toBe(true);
    expect(erroresMilitante({ ...ok, telefono: "" }).telefono).toBe(true);
  });
  it("el correo es opcional, pero si viene debe tener formato válido", () => {
    expect(erroresMilitante({ ...ok, email: "" }).email).toBe(false);
    expect(erroresMilitante({ ...ok, email: "sin-arroba" }).email).toBe(true);
    expect(erroresMilitante({ ...ok, email: "A@B.com " }).email).toBe(false);
  });
  it("exige cédula y nombre", () => {
    expect(erroresMilitante({ ...ok, cedula: "050235346" }).cedula).toBe(true);
    expect(erroresMilitante({ ...ok, nombres: "  " }).nombres).toBe(true);
  });
});
