import { describe, expect, it } from "vitest";
import {
  razonesIncorrecto,
  SEPARADOR_INCORRECTOS,
  textoIncorrectos,
} from "../src/lib/gestion/copiarIncorrectos";
import type { Militante } from "../src/lib/gestion/types";

const mil = (parcial: Partial<Militante>): Militante =>
  ({
    id: "x",
    cedula: "0503451163",
    nombres: "Ana Pérez",
    telefono: "0998210599",
    email: "",
    responsableLiderId: null,
    incorrecto: false,
    ...parcial,
  }) as Militante;

const responsable = (id: string | null) =>
  id === "u" ? "Comisión Control Electoral Urbana" : "";

describe("razonesIncorrecto", () => {
  it("dice cuántos dígitos trae la cédula", () => {
    expect(razonesIncorrecto(mil({ cedula: "05017084302" }))).toEqual([
      "La cédula tiene 11 dígitos (debe tener 10).",
    ]);
  });

  it("distingue dígito verificador, nombre y teléfono faltante", () => {
    expect(razonesIncorrecto(mil({ cedula: "0503451164" }))).toEqual([
      "La cédula no pasa el dígito verificador.",
    ]);
    expect(razonesIncorrecto(mil({ nombres: " ", telefono: "" }))).toEqual([
      "Falta el nombre.",
      "Falta el teléfono.",
    ]);
  });

  it("explica el teléfono corto y el correo mal formado", () => {
    expect(
      razonesIncorrecto(mil({ telefono: "98210599", email: "a@b" })),
    ).toEqual([
      "El teléfono tiene 8 dígitos (debe tener 10).",
      'El correo "a@b" no tiene un formato válido.',
    ]);
  });

  it("una fila correcta no tiene razones", () => {
    expect(razonesIncorrecto(mil({}))).toEqual([]);
  });
});

describe("textoIncorrectos", () => {
  it("arma cada registro con el formato pedido y los separa", () => {
    const texto = textoIncorrectos(
      [
        mil({
          nombres: "Ana María Cárdenas Viteri",
          cedula: "05017084302",
          email: "ana@correo.com",
          responsableLiderId: "u",
          incorrecto: true,
        }),
        mil({ nombres: "Correcto", incorrecto: false }),
        mil({ nombres: "Luis", telefono: "", incorrecto: true }),
      ],
      responsable,
    );
    expect(texto).toBe(
      [
        "Nombres: Ana María Cárdenas Viteri",
        "Cédula: 05017084302",
        "Teléfono: 0998210599",
        "Correo: ana@correo.com",
        "Responsable: Comisión Control Electoral Urbana",
        "Razón de incorrecto: La cédula tiene 11 dígitos (debe tener 10).",
        SEPARADOR_INCORRECTOS,
        "Nombres: Luis",
        "Cédula: 0503451163",
        "Teléfono: ",
        "Correo: ",
        "Responsable: ",
        "Razón de incorrecto: Falta el teléfono.",
      ].join("\n"),
    );
  });

  it("sin registros incorrectos devuelve texto vacío", () => {
    expect(textoIncorrectos([mil({})], responsable)).toBe("");
  });
});
