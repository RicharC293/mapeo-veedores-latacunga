import { describe, expect, it } from "vitest";
import {
  agruparPorNumero,
  CAMPOS_DE_EQUIPO,
  camposVacios,
  coincideFiltros,
  combinarDatos,
  datosDe,
  FILTROS_INICIALES,
  leerFiltros,
  armarEquipos,
  rellenar,
  SIN_CDA,
  textoEquipo,
  unirTextos,
  type PuestoEquipo,
  type PersonaComunicado,
} from "../src/lib/comunicados/plan";
import type { ParroquiaBasica, Recinto } from "../src/lib/types";

const persona = (extra: Partial<PersonaComunicado>): PersonaComunicado => ({
  cedula: "0503451163",
  nombres: "PÉREZ LÓPEZ ANA MARÍA",
  saludo: "Ana María",
  apellidos: "Pérez López",
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
      apellido: "Pérez López",
      rol: "veedora",
      recinto: "Colegio Urbano",
      parroquia: "La Matriz",
      direccion: "Av. Amazonas y Quito",
      junta: "junta 3 femenina",
      grupo: "",
      equipoCoordinador: "",
      equipoCda: "",
      equipoVeedores: "",
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

describe("equipo del recinto", () => {
  // Recinto 2 con juntas 1F, 2F y 1M, y CDA.
  const conJuntas = {
    ...recinto,
    cda: true,
    jf: 2,
    fi: 1,
    ff: 2,
    jm: 1,
    mi: 1,
    mf: 1,
  } as Recinto;
  const sinCda = { ...conJuntas, cod: 3, cda: false } as Recinto;
  const puesto = (extra: Partial<PuestoEquipo>): PuestoEquipo => ({
    clase: "veedor",
    recintoCodigo: 2,
    nombres: "PÉREZ LÓPEZ ANA MARÍA",
    telefono: "0987654321",
    tipo: "titular",
    juntaId: "2-F1",
    ...extra,
  });
  const equipos = armarEquipos(
    [conJuntas, sinCda],
    [
      puesto({}),
      puesto({
        nombres: "PILA TOASA JUAN",
        telefono: "",
        tipo: "suplente",
      }),
      puesto({ nombres: "CHAUCA IZA MARTA", juntaId: "2-M1" }),
      puesto({
        clase: "coordinador",
        nombres: "MENA RUIZ LUIS",
        tipo: "suplente",
        juntaId: null,
      }),
    ],
  );

  it("lista cada junta con su teléfono y marca las que faltan", () => {
    expect(textoEquipo(equipos[2].veedor)).toBe(
      [
        "1F: PÉREZ LÓPEZ ANA MARÍA - 0987654321",
        "1F suplente: PILA TOASA JUAN",
        "1M: CHAUCA IZA MARTA - 0987654321",
        "2F: AÚN NO SE HA ASIGNADO",
      ].join("\n"),
    );
  });

  it("marca también al coordinador y al CDA que faltan", () => {
    expect(textoEquipo(equipos[2].coordinador)).toBe(
      "AÚN NO SE HA ASIGNADO\nSuplente: MENA RUIZ LUIS - 0987654321",
    );
    expect(textoEquipo(equipos[2].cda!)).toBe("AÚN NO SE HA ASIGNADO");
    expect(equipos[3].cda).toBeNull();
  });

  it("solo el coordinador recibe el equipo de su recinto", () => {
    const coordinador = persona({ clase: "coordinador", juntaId: null });
    const datos = datosDe(coordinador, conJuntas, urbana, "", "", equipos[2]);
    expect(rellenar("CDA: {equipoCda}", datos)).toBe(
      "CDA: AÚN NO SE HA ASIGNADO",
    );
    expect(datos.equipoVeedores.split("\n")).toHaveLength(4);
    const otro = datosDe(
      { ...coordinador, recintoCodigo: 3 },
      sinCda,
      urbana,
      "",
      "",
      equipos[3],
    );
    expect(otro.equipoCda).toBe(SIN_CDA);
    expect(otro.equipoVeedores).toBe(
      "1F: AÚN NO SE HA ASIGNADO\n1M: AÚN NO SE HA ASIGNADO\n2F: AÚN NO SE HA ASIGNADO",
    );
  });

  it("deja el equipo vacío a quien no es coordinador, sin avisar", () => {
    for (const clase of ["veedor", "cda", null] as const) {
      const datos = datosDe(
        persona({ clase }),
        conJuntas,
        urbana,
        "",
        "",
        equipos[2],
      );
      expect(datos.equipoCoordinador).toBe("");
      expect(datos.equipoVeedores).toBe("");
      expect(
        camposVacios("{equipoVeedores} {enlace}", datos, CAMPOS_DE_EQUIPO),
      ).toEqual(["enlace"]);
    }
  });
});
