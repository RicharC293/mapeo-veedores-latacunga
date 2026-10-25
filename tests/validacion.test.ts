import { describe, expect, it } from "vitest";
import { consultarCedula } from "../src/lib/validacion/ecuadorApi";
import {
  aTitulo,
  compararNombres,
  nombreOficial,
} from "../src/lib/validacion/nombres";
import {
  agruparPersonas,
  resumirValidacion,
  type ValidacionCedula,
} from "../src/lib/validacion/plan";

// fetch simulado: no se hace ninguna consulta real (cada una cuesta dinero).
const respuesta = (status: number, cuerpo: unknown) =>
  (async () =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

const EXITO = {
  data: {
    id: "1700000000",
    full_name: "PÉREZ GARCÍA JUAN ANDRÉS",
    first_name: "JUAN ANDRÉS",
    last_name: "PÉREZ GARCÍA",
    birth_date: "1990-04-18",
    age: 36,
    gender: "male",
    birth_place: "PICHINCHA, QUITO, IÑAQUITO",
  },
  error: null,
  message: null,
};

describe("consultarCedula", () => {
  it("envía la clave y la cédula a la API", async () => {
    let url = "";
    let auth = "";
    const f = (async (u: string, init: RequestInit) => {
      url = u;
      auth = (init.headers as Record<string, string>).Authorization;
      return new Response(JSON.stringify(EXITO), { status: 200 });
    }) as unknown as typeof fetch;
    await consultarCedula("1700000000", "clave123", f);
    expect(url).toBe("https://api.ecuadorapi.com/api/v1/cedulas/1700000000");
    expect(auth).toBe("Bearer clave123");
  });

  it("una respuesta con datos queda validada y guarda el JSON íntegro", async () => {
    const r = await consultarCedula("1700000000", "k", respuesta(200, EXITO));
    expect(r).toMatchObject({
      estado: "validada",
      httpStatus: 200,
      nombres: "JUAN ANDRÉS",
      apellidos: "PÉREZ GARCÍA",
      nombreCompleto: "PÉREZ GARCÍA JUAN ANDRÉS",
      detener: false,
    });
    expect(r.respuesta).toEqual(EXITO);
  });

  it("sin datos o con 404 queda como no encontrada (no se repite)", async () => {
    const vacio = {
      data: null,
      error: "not_found",
      message: "Cédula no encontrada",
    };
    expect(
      (await consultarCedula("1", "k", respuesta(404, vacio))).estado,
    ).toBe("no_encontrada");
    const r = await consultarCedula("1", "k", respuesta(200, vacio));
    expect(r.estado).toBe("no_encontrada");
    expect(r.error).toBe("Cédula no encontrada");
  });

  it("clave inválida, sin saldo o demasiadas consultas detienen la corrida", async () => {
    for (const status of [401, 402, 403, 429]) {
      const r = await consultarCedula(
        "1",
        "k",
        respuesta(status, { error: "x" }),
      );
      expect(r.estado).toBe("error");
      expect(r.detener).toBe(true);
    }
  });

  it("una falla del servicio o de red es un error que se reintenta", async () => {
    const r = await consultarCedula(
      "1",
      "k",
      respuesta(503, { error: "down" }),
    );
    expect(r).toMatchObject({ estado: "error", detener: false });
    const sinRed = (async () => {
      throw new Error("sin conexión");
    }) as unknown as typeof fetch;
    const r2 = await consultarCedula("1", "k", sinRed);
    expect(r2).toMatchObject({
      estado: "error",
      httpStatus: null,
      detener: false,
    });
  });
});

describe("nombres", () => {
  it("pone mayúscula inicial y deja las partículas en minúscula", () => {
    expect(aTitulo("MARÍA DE LOS ÁNGELES")).toBe("María de los Ángeles");
    expect(aTitulo("  JUAN   ANDRÉS ")).toBe("Juan Andrés");
  });

  it("el formato del sistema es nombres y luego apellidos", () => {
    expect(nombreOficial("JUAN ANDRÉS", "PÉREZ GARCÍA")).toBe(
      "Juan Andrés Pérez García",
    );
    expect(nombreOficial(null, null, "PÉREZ GARCÍA JUAN")).toBe(
      "Pérez García Juan",
    );
  });

  it("compara sin importar mayúsculas, tildes ni orden", () => {
    const oficial = "Juan Andrés Pérez García";
    expect(compararNombres("PEREZ GARCIA JUAN ANDRES", oficial)).toBe("igual");
    expect(compararNombres("Juan Pérez García", oficial)).toBe("parecido");
    expect(compararNombres("Ana Lucía Torres", oficial)).toBe("distinto");
  });
});

const val = (cedula: string, estado: ValidacionCedula["estado"], extra = {}) =>
  ({
    cedula,
    estado,
    nombres: null,
    apellidos: null,
    nombreCompleto: null,
    respuesta: null,
    httpStatus: 200,
    error: null,
    intentos: 1,
    proveedor: "ecuadorapi",
    consultadoEn: "2026-10-25",
    ...extra,
  }) as ValidacionCedula;

describe("plan de validación", () => {
  const personas = agruparPersonas([
    {
      donde: "Veedor",
      personas: [{ cedula: "0503451163", nombres: "PEREZ GARCIA JUAN ANDRES" }],
    },
    {
      donde: "Militancia",
      personas: [
        { cedula: "0503451163", nombres: "Juan Pérez" },
        { cedula: "0502646599", nombres: "Ana Torres" },
        { cedula: "0550173926", nombres: "Luis Vaca" },
        { cedula: "0504724395", nombres: "Diego Chávez" }, // dígito verificador mal
        { cedula: null, nombres: "Sin cédula" },
      ],
    },
  ]);

  it("agrupa por cédula, junta los nombres y pone primero a los asignados", () => {
    expect(personas.map((p) => p.cedula)).toEqual([
      "0503451163",
      "0502646599",
      "0504724395",
      "0550173926",
    ]);
    expect(personas[0]).toEqual({
      cedula: "0503451163",
      nombres: ["PEREZ GARCIA JUAN ANDRES", "Juan Pérez"],
      donde: ["Veedor", "Militancia"],
    });
  });

  it("excluye las ya consultadas, reintenta los errores y no consulta las inválidas", () => {
    const r = resumirValidacion(personas, [
      val("0503451163", "validada", {
        nombres: "JUAN ANDRÉS",
        apellidos: "PÉREZ GARCÍA",
      }),
      val("0502646599", "no_encontrada"),
      val("0550173926", "error"),
    ]);
    expect(r.validadas).toBe(1);
    expect(r.noEncontradas).toBe(1);
    expect(r.conError).toBe(1);
    expect(r.pendientes.map((p) => p.cedula)).toEqual(["0550173926"]);
    expect(r.invalidas.map((p) => p.cedula)).toEqual(["0504724395"]);
  });

  it("propone corregir los nombres que no están en el formato oficial", () => {
    const r = resumirValidacion(personas, [
      val("0503451163", "validada", {
        nombres: "JUAN ANDRÉS",
        apellidos: "PÉREZ GARCÍA",
      }),
    ]);
    expect(r.revision).toEqual([
      {
        cedula: "0503451163",
        registrados: ["PEREZ GARCIA JUAN ANDRES", "Juan Pérez"],
        oficial: "Juan Andrés Pérez García",
        coincidencia: "parecido",
        donde: ["Veedor", "Militancia"],
      },
    ]);
  });

  it("un nombre ya en el formato oficial no aparece para revisar", () => {
    const solo = agruparPersonas([
      {
        donde: "Veedor",
        personas: [
          { cedula: "0503451163", nombres: "Juan Andrés Pérez García" },
        ],
      },
    ]);
    const r = resumirValidacion(solo, [
      val("0503451163", "validada", {
        nombres: "JUAN ANDRÉS",
        apellidos: "PÉREZ GARCÍA",
      }),
    ]);
    expect(r.revision).toEqual([]);
  });
});
