import { describe, expect, it } from "vitest";
import {
  claveDePuesto,
  enlaceWhatsapp,
  mensajeWhatsapp,
  nombreDeSaludo,
  situacionContacto,
  telefonoWhatsapp,
  textoJunta,
  type Contacto,
  type PuestoContacto,
} from "../src/lib/contacto/plan";

describe("telefonoWhatsapp", () => {
  it("pasa los celulares ecuatorianos al formato de wa.me", () => {
    expect(telefonoWhatsapp("0987654321")).toBe("593987654321");
    expect(telefonoWhatsapp("098 765 4321")).toBe("593987654321");
    expect(telefonoWhatsapp("+593 98 765 4321")).toBe("593987654321");
    expect(telefonoWhatsapp("987654321")).toBe("593987654321");
  });

  it("rechaza lo que no es un celular", () => {
    expect(telefonoWhatsapp("")).toBeNull();
    expect(telefonoWhatsapp("032812345")).toBeNull();
    expect(telefonoWhatsapp("09876543")).toBeNull();
  });
});

describe("nombreDeSaludo", () => {
  it("usa los nombres del Registro Civil", () => {
    expect(nombreDeSaludo("PÉREZ LÓPEZ JUAN CARLOS", "JUAN CARLOS")).toBe(
      "Juan Carlos",
    );
  });

  it("sin ellos, toma lo que sigue a los dos apellidos", () => {
    expect(nombreDeSaludo("PÉREZ LÓPEZ MARÍA JOSÉ", null)).toBe("María José");
    expect(nombreDeSaludo("ANA", null)).toBe("Ana");
  });
});

describe("mensajeWhatsapp", () => {
  const base = {
    nombre: "Juan",
    femenino: false,
    clase: "veedor" as const,
    tipo: "titular" as const,
    recinto: "U.E. Isidro Ayora",
    parroquia: "Eloy Alfaro (San Felipe)",
    direccion: "Av. Amazonas y Quito",
    juntaId: "354-M3",
  };

  it("arma el mensaje con el puesto, la parroquia y la dirección en mayúsculas", () => {
    const m = mensajeWhatsapp(base);
    expect(m.startsWith("¡Hola, Juan! 👋")).toBe(true);
    expect(m).toContain(
      "has sido asignado como VEEDOR en la JUNTA 3 MASCULINA del recinto electoral U.E. ISIDRO AYORA, de la parroquia ELOY ALFARO (SAN FELIPE), ubicado en AV. AMAZONAS Y QUITO, para la jornada electoral del DOMINGO 29 DE NOVIEMBRE.",
    );
    expect(m).toContain("No olvides indicar a qué junta perteneces.");
    expect(m.endsWith("Campo Ciudad, Una Sola Fuerza")).toBe(true);
  });

  it("concuerda con el género, marca al suplente y sin junta pide el recinto", () => {
    const m = mensajeWhatsapp({
      ...base,
      femenino: true,
      clase: "coordinador",
      tipo: "suplente",
      juntaId: null,
    });
    expect(m).toContain(
      "has sido asignada como COORDINADORA SUPLENTE en el recinto electoral U.E. ISIDRO AYORA, de la parroquia",
    );
    expect(m).toContain("No olvides indicar a qué recinto perteneces.");
    expect(mensajeWhatsapp({ ...base, clase: "cda", juntaId: null })).toContain(
      "como ACREDITADO DEL CDA en",
    );
  });

  it("sin dirección no la menciona", () => {
    expect(mensajeWhatsapp({ ...base, direccion: " " })).toContain(
      "(SAN FELIPE), para la jornada",
    );
  });

  it("el enlace lleva el mensaje codificado", () => {
    expect(enlaceWhatsapp("593987654321", "¡Hola! 👋")).toBe(
      "https://wa.me/593987654321?text=%C2%A1Hola!%20%F0%9F%91%8B",
    );
  });
});

describe("textoJunta", () => {
  it("convierte la etiqueta de la junta", () => {
    expect(textoJunta("354-F12")).toBe("junta 12 femenina");
    expect(textoJunta("M1")).toBe("junta 1 masculina");
  });
});

describe("situacionContacto", () => {
  const puesto: PuestoContacto = {
    clase: "veedor",
    tipo: "titular",
    recintoCodigo: 354,
    juntaId: "354-M3",
  };
  const contacto = (extra: Partial<Contacto>): Contacto => ({
    cedula: "0503451163",
    estado: "enviado",
    intentos: 1,
    ultimoEnvio: "2026-10-26T15:00:00Z",
    puestoEnviado: claveDePuesto(puesto),
    cedulaRecibida: false,
    actualizadoPor: null,
    actualizadoEn: "2026-10-26T15:00:00Z",
    ...extra,
  });

  it("sin contacto: pendiente, o confirmado si ya estaba verificado", () => {
    expect(situacionContacto(puesto, false, undefined)).toEqual({
      estado: "pendiente",
      cambioDePuesto: false,
      verificadoAntes: false,
    });
    expect(situacionContacto(puesto, true, undefined)).toEqual({
      estado: "confirmado",
      cambioDePuesto: false,
      verificadoAntes: true,
    });
  });

  it("avisa si la persona cambió de puesto después del mensaje", () => {
    expect(situacionContacto(puesto, false, contacto({})).cambioDePuesto).toBe(
      false,
    );
    const otro = situacionContacto(
      { ...puesto, juntaId: "354-M4" },
      false,
      contacto({}),
    );
    expect(otro).toMatchObject({ estado: "enviado", cambioDePuesto: true });
  });
});
