import { describe, expect, it } from "vitest";
import { veedoresEnMesaInexistente } from "../src/lib/gestion/mesasInexistentes";
import type { Recinto } from "../src/lib/types";

// Recinto 354 con mesas F36 a F37 y M33 a M34.
const recintos = [
  {
    cod: 354,
    par: 1,
    nombre: "R",
    cda: false,
    jf: 2,
    jm: 2,
    fi: 36,
    ff: 37,
    mi: 33,
    mf: 34,
  },
] as Recinto[];
const v = (id: string, juntaId: string, recintoCodigo = 354) => ({
  id,
  juntaId,
  recintoCodigo,
});

describe("veedoresEnMesaInexistente", () => {
  it("deja pasar los veedores en mesas que el recinto tiene", () => {
    expect(
      veedoresEnMesaInexistente(
        [v("a", "354-F36"), v("b", "354-M34")],
        recintos,
      ),
    ).toEqual([]);
  });

  it("detecta una mesa que el recinto no tiene", () => {
    const r = veedoresEnMesaInexistente(
      [v("a", "354-F36"), v("b", "354-M15")],
      recintos,
    );
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("detecta una mesa de otro recinto y un recinto que no existe", () => {
    const r = veedoresEnMesaInexistente(
      [v("a", "406-F21", 354), v("b", "999-F1", 999)],
      recintos,
    );
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
