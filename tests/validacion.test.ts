import { describe, expect, it } from "vitest";
import { consultarCedula } from "../src/lib/validacion/ecuadorApi";
import {
  aTitulo,
  compararNombres,
  nombreOficial,
} from "../src/lib/validacion/nombres";
import {
  datosPersonales,
  edad,
  estadoIdentidad,
  sePuedeConsultar,
  type ValidacionCedula,
} from "../src/lib/validacion/plan";
import { identidadPorCedula } from "../src/lib/validacion/pantalla";

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
    fechaNacimiento: null,
    genero: null,
    nombreMantenido: false,
    respuesta: null,
    httpStatus: 200,
    error: null,
    intentos: 1,
    proveedor: "ecuadorapi",
    consultadoEn: "2026-10-25",
    ...extra,
  }) as ValidacionCedula;

const JUAN = { nombres: "JUAN ANDRÉS", apellidos: "PÉREZ GARCÍA" };

describe("estadoIdentidad", () => {
  it("sin consulta: sin consultar, o cédula inválida si falla el dígito verificador", () => {
    expect(estadoIdentidad("Ana", "0503451163", undefined).estado).toBe(
      "sin_consultar",
    );
    expect(estadoIdentidad("Diego", "0504724395", undefined).estado).toBe(
      "invalida",
    );
  });

  it("un error técnico se puede volver a consultar; no encontrada no", () => {
    expect(
      estadoIdentidad("Ana", "0503451163", val("0503451163", "error")).estado,
    ).toBe("error");
    expect(
      estadoIdentidad("Ana", "0503451163", val("0503451163", "no_encontrada"))
        .estado,
    ).toBe("no_encontrada");
  });

  it("validada: verificada si ya tiene el nombre oficial, coincide si solo cambia el formato", () => {
    const v = val("0503451163", "validada", JUAN);
    expect(
      estadoIdentidad("Juan Andrés Pérez García", "0503451163", v),
    ).toEqual({
      estado: "verificada",
      oficial: "Juan Andrés Pérez García",
      coincidencia: null,
    });
    expect(
      estadoIdentidad("PEREZ GARCIA JUAN ANDRES", "0503451163", v),
    ).toEqual({
      estado: "coincide",
      oficial: "Juan Andrés Pérez García",
      coincidencia: "igual",
    });
  });

  it("un nombre parecido o distinto queda por revisar, salvo que se haya mantenido", () => {
    const v = val("0503451163", "validada", JUAN);
    expect(estadoIdentidad("Juan Pérez", "0503451163", v)).toMatchObject({
      estado: "revisar",
      coincidencia: "parecido",
    });
    expect(estadoIdentidad("Ana Torres", "0503451163", v)).toMatchObject({
      estado: "revisar",
      coincidencia: "distinto",
    });
    expect(
      estadoIdentidad(
        "Juan Pérez",
        "0503451163",
        val("0503451163", "validada", { ...JUAN, nombreMantenido: true }),
      ).estado,
    ).toBe("verificada");
  });
});

describe("sePuedeConsultar", () => {
  it("solo las válidas sin consulta previa o con error técnico", () => {
    expect(sePuedeConsultar("0503451163", undefined)).toBe(true);
    expect(sePuedeConsultar("0503451163", val("0503451163", "error"))).toBe(
      true,
    );
    expect(sePuedeConsultar("0503451163", val("0503451163", "validada"))).toBe(
      false,
    );
    expect(
      sePuedeConsultar("0503451163", val("0503451163", "no_encontrada")),
    ).toBe(false);
    expect(sePuedeConsultar("0504724395", undefined)).toBe(false);
  });
});

describe("datos personales", () => {
  it("toma fecha y género de las columnas o, si faltan, del JSON guardado", () => {
    expect(
      datosPersonales(
        val("1", "validada", {
          fechaNacimiento: "1990-04-18",
          genero: "female",
        }),
      ),
    ).toEqual({ fechaNacimiento: "1990-04-18", genero: "femenino" });
    expect(datosPersonales(val("1", "validada", { respuesta: EXITO }))).toEqual(
      { fechaNacimiento: "1990-04-18", genero: "masculino" },
    );
    expect(datosPersonales(val("1", "no_encontrada"))).toEqual({
      fechaNacimiento: null,
      genero: null,
    });
  });

  it("la edad se calcula al día, contando si ya cumplió años", () => {
    expect(edad("1990-04-18", new Date(2026, 3, 17))).toBe(35);
    expect(edad("1990-04-18", new Date(2026, 3, 18))).toBe(36);
    expect(edad(null, new Date())).toBeNull();
    expect(edad("basura", new Date())).toBeNull();
  });
});

describe("identidad en el Consolidado", () => {
  it("marca verificada o por revisar y da los datos personales", () => {
    const r = identidadPorCedula(
      [
        { cedula: "0503451163", nombres: "Juan Andrés Pérez García" },
        { cedula: "0502646599", nombres: "Otro Nombre" },
        { cedula: "0550173926", nombres: "Sin consultar" },
      ],
      [
        val("0503451163", "validada", {
          ...JUAN,
          fechaNacimiento: "1990-04-18",
          genero: "male",
        }),
        val("0502646599", "validada", JUAN),
      ],
    );
    expect(r["0503451163"]).toEqual({
      verificada: true,
      porRevisar: false,
      fechaNacimiento: "1990-04-18",
      genero: "masculino",
    });
    expect(r["0502646599"]).toMatchObject({
      verificada: false,
      porRevisar: true,
    });
    expect(r["0550173926"]).toBeUndefined();
  });
});
