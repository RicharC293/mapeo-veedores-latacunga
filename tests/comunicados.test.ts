import { describe, expect, it } from "vitest";
import {
  agruparPorNumero,
  camposVacios,
  coincideFiltros,
  combinarDatos,
  datosDe,
  FILTROS_INICIALES,
  leerFiltros,
  rellenar,
  unirTextos,
  type PersonaComunicado,
} from "../src/lib/comunicados/plan";
import type { ParroquiaBasica, Recinto } from "../src/lib/types";

const persona = (extra: Partial<PersonaComunicado>): PersonaComunicado => ({
  cedula: "0503451163",
  nombres: "PÉREZ LÓPEZ ANA MARÍA",
  saludo: "Ana María",
  telefono: "0987654321",
  femenino: true,
  clase: "veedor",
  tipo: "titular",
  recintoCodigo: 2,
  juntaId: "2-F3",
  responsableId: "lider-1",
  ...extra,
});
const recinto = {
  cod: 2,
  par: 20,
  nombre: "COLEGIO URBANO",
  dir: "AV. AMAZONAS Y QUITO",
} as Recinto;
const urbana = {
  properties: { code: 20, name: "La Matriz", urbana: true },
} as ParroquiaBasica;
const rural = {
  properties: { code: 10, name: "Toacaso", urbana: false },
} as ParroquiaBasica;

describe("leerFiltros", () => {
  it("completa lo que falta con los valores por defecto", () => {
    expect(leerFiltros(null)).toEqual(FILTROS_INICIALES);
    expect(
      leerFiltros({ ubicacion: 20, dignidades: ["veedor", "otro"], tipo: "x" }),
    ).toEqual({
      ...FILTROS_INICIALES,
      ubicacion: 20,
      dignidades: ["veedor"],
    });
  });
});

describe("coincideFiltros", () => {
  const f = FILTROS_INICIALES;

  it("filtra por ubicación, recinto, dignidad, tipo y responsable", () => {
    const p = persona({});
    expect(coincideFiltros(p, f, urbana)).toBe(true);
    expect(coincideFiltros(p, { ...f, ubicacion: "rurales" }, urbana)).toBe(
      false,
    );
    expect(coincideFiltros(p, { ...f, recinto: 9 }, urbana)).toBe(false);
    expect(
      coincideFiltros(p, { ...f, dignidades: ["coordinador"] }, urbana),
    ).toBe(false);
    expect(coincideFiltros(p, { ...f, tipo: "suplente" }, urbana)).toBe(false);
    expect(coincideFiltros(p, { ...f, responsable: "sin" }, urbana)).toBe(
      false,
    );
    expect(coincideFiltros(p, { ...f, responsable: "lider-1" }, urbana)).toBe(
      true,
    );
  });

  it("Militancia solo entra si se pide, sin mirar dignidad ni tipo", () => {
    const m = persona({ clase: null, tipo: null, juntaId: null });
    expect(coincideFiltros(m, f, rural)).toBe(false);
    expect(
      coincideFiltros(m, { ...f, militancia: true, tipo: "titular" }, rural),
    ).toBe(true);
  });
});

describe("mensaje", () => {
  it("completa los datos de la persona", () => {
    const datos = datosDe(persona({}), recinto, urbana, " https://x.y ");
    expect(datos).toEqual({
      nombre: "Ana María",
      rol: "veedora",
      recinto: "Colegio Urbano",
      parroquia: "La Matriz",
      direccion: "Av. Amazonas y Quito",
      junta: "junta 3 femenina",
      grupo: "",
      enlace: "https://x.y",
    });
    expect(rellenar("Hola {nombre}, {rol} en {recinto}. {otro}", datos)).toBe(
      "Hola Ana María, veedora en Colegio Urbano. {otro}",
    );
  });

  it("avisa de los datos que quedarían vacíos", () => {
    const datos = datosDe(
      persona({ clase: "coordinador", juntaId: null }),
      recinto,
      urbana,
      "",
    );
    expect(camposVacios("{nombre} {junta} {enlace}", datos)).toEqual([
      "junta",
      "enlace",
    ]);
  });

  it("une a quienes comparten celular", () => {
    expect(unirTextos(["Ana", "Luis", "Ana", ""])).toBe("Ana y Luis");
    expect(unirTextos(["A", "B", "C"])).toBe("A, B y C");
    const a = datosDe(persona({}), recinto, urbana, "");
    const b = datosDe(
      persona({ saludo: "Luis", femenino: false, juntaId: "2-M1" }),
      recinto,
      urbana,
      "",
    );
    const juntos = combinarDatos([a, b]);
    expect(juntos.nombre).toBe("Ana María y Luis");
    expect(juntos.recinto).toBe("Colegio Urbano");
    expect(juntos.rol).toBe("veedora y veedor");
  });
});

describe("agruparPorNumero", () => {
  it("agrupa por celular y deja aparte los inválidos", () => {
    const { grupos, sinNumero } = agruparPorNumero(
      [
        persona({ cedula: "1" }),
        persona({ cedula: "2", telefono: "098 765 4321" }),
        persona({ cedula: "3", telefono: "032812345" }),
      ],
      (p) =>
        p.telefono.replace(/\D/g, "") === "0987654321" ? "593987654321" : null,
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].personas.map((p) => p.cedula)).toEqual(["1", "2"]);
    expect(sinNumero.map((p) => p.cedula)).toEqual(["3"]);
  });
});

describe("grupo del recinto", () => {
  it("pone el enlace del grupo donde dice {grupo}", () => {
    const datos = datosDe(
      persona({}),
      recinto,
      urbana,
      "",
      "https://chat.whatsapp.com/ABCDEFGHIJ",
    );
    expect(rellenar("Únete: {grupo}", datos)).toBe(
      "Únete: https://chat.whatsapp.com/ABCDEFGHIJ",
    );
    expect(
      camposVacios("{grupo}", datosDe(persona({}), recinto, urbana, "")),
    ).toEqual(["grupo"]);
  });
});

describe("solo recintos con grupo", () => {
  it("deja fuera a quien está en un recinto sin grupo", () => {
    const f = { ...FILTROS_INICIALES, soloConGrupo: true };
    expect(coincideFiltros(persona({}), f, urbana, false)).toBe(false);
    expect(coincideFiltros(persona({}), f, urbana, true)).toBe(true);
    expect(leerFiltros({ soloConGrupo: true }).soloConGrupo).toBe(true);
  });
});
