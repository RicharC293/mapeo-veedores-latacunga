import { title } from "../format";

// Lógica pura del contacto por WhatsApp (la verificación 3): el número al que
// se escribe, el mensaje que se envía y en qué estado está cada persona. Sin
// base ni API, para poder probarla.

// enviado: se abrió el mensaje en WhatsApp y se espera la respuesta.
// confirmado: respondió confirmando su participación (queda verificada).
// numero_equivocado: el celular no es de la persona o no tiene WhatsApp.
// Quien no participa no tiene estado: se desvincula a la lista negra.
export type EstadoGuardado = "enviado" | "confirmado" | "numero_equivocado";
export type EstadoContacto = "pendiente" | EstadoGuardado;

export interface Contacto {
  cedula: string;
  estado: EstadoGuardado;
  intentos: number;
  ultimoEnvio: string | null;
  // Puesto que decía el último mensaje (ver claveDePuesto): si la persona se
  // movió después, hay que volver a escribirle.
  puestoEnviado: string | null;
  cedulaRecibida: boolean;
  actualizadoPor: string | null;
  actualizadoEn: string;
}

export type Clase = "veedor" | "coordinador" | "cda";

export interface PuestoContacto {
  clase: Clase;
  tipo: "titular" | "suplente";
  recintoCodigo: number;
  juntaId: string | null;
}

export function claveDePuesto(p: PuestoContacto): string {
  return [p.clase, p.tipo, p.recintoCodigo, p.juntaId ?? ""].join("|");
}

// Número en el formato que pide wa.me (593 y el celular sin el 0), o null si
// no parece un celular ecuatoriano.
export function telefonoWhatsapp(telefono: string): string | null {
  const d = telefono.replace(/\D/g, "");
  if (/^09\d{8}$/.test(d)) return `593${d.slice(1)}`;
  if (/^9\d{8}$/.test(d)) return `593${d}`;
  if (/^5939\d{8}$/.test(d)) return d;
  return null;
}

// Nombres de pila para el saludo: los del Registro Civil o, si faltan, lo que
// sigue a los dos apellidos (el sistema guarda APELLIDO APELLIDO NOMBRE …).
export function nombreDeSaludo(
  nombres: string,
  nombresOficiales: string | null,
): string {
  const oficiales = nombresOficiales?.trim();
  if (oficiales) return title(oficiales);
  const partes = nombres.trim().split(/\s+/);
  const pila = partes.length > 2 ? partes.slice(2) : partes;
  return title(pila.join(" "));
}

const ROL: Record<Clase, { m: string; f: string }> = {
  veedor: { m: "veedor", f: "veedora" },
  coordinador: { m: "coordinador", f: "coordinadora" },
  cda: { m: "acreditado del CDA", f: "acreditada del CDA" },
};

// "M3" → "junta 3 masculina".
export function textoJunta(juntaId: string): string {
  const etiqueta = juntaId.slice(juntaId.lastIndexOf("-") + 1);
  const m = /^([FM])(\d+)$/.exec(etiqueta);
  if (!m) return `junta ${etiqueta}`;
  return `junta ${m[2]} ${m[1] === "F" ? "femenina" : "masculina"}`;
}

export interface DatosMensaje {
  nombre: string;
  femenino: boolean;
  clase: Clase;
  tipo: "titular" | "suplente";
  recinto: string;
  juntaId: string | null;
}

export function mensajeWhatsapp(d: DatosMensaje): string {
  const rol = `${ROL[d.clase][d.femenino ? "f" : "m"]}${d.tipo === "suplente" ? " suplente" : ""}`;
  const lugar = `el recinto electoral ${title(d.recinto)}${d.juntaId ? `, ${textoJunta(d.juntaId)}` : ""}`;
  return [
    `¡Hola, ${d.nombre}! 👋`,
    "Recibe un cordial saludo de parte del Arq. Rodrigo Espín y de la alianza Campo Ciudad, Una Sola Fuerza.",
    `Nos complace informarte que has sido ${d.femenino ? "asignada" : "asignado"} como ${rol} en ${lugar}, para la jornada electoral del domingo 29 de noviembre.`,
    `Para facilitar tu proceso de acreditación, te solicitamos amablemente que nos envíes una foto de tu cédula de identidad por ambos lados. También puedes entregar una copia física en nuestra sede cantonal, ubicada frente al colegio Victoria Vásconez Cuvi, o hacerla llegar a través de los candidatos de nuestra alianza en las diferentes parroquias. No olvides indicar a qué ${d.juntaId ? "junta" : "recinto"} perteneces.`,
    "🤝 Tu participación es muy importante para nosotros y para el desarrollo de esta jornada.",
    "Por favor, confírmanos tu participación respondiendo a este mensaje.",
    "¡Muchas gracias por tu compromiso y por ser parte de este equipo! 💪",
    "Campo Ciudad, Una Sola Fuerza",
  ].join("\n\n");
}

export function enlaceWhatsapp(numero: string, mensaje: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export interface SituacionContacto {
  estado: EstadoContacto;
  // Se le escribió para otro puesto: el mensaje ya no corresponde.
  cambioDePuesto: boolean;
  // Verificada antes de existir este módulo (sin registro de contacto).
  verificadoAntes: boolean;
}

export function situacionContacto(
  puesto: PuestoContacto,
  verificado: boolean,
  c: Contacto | undefined,
): SituacionContacto {
  if (!c) {
    return verificado
      ? { estado: "confirmado", cambioDePuesto: false, verificadoAntes: true }
      : { estado: "pendiente", cambioDePuesto: false, verificadoAntes: false };
  }
  return {
    estado: c.estado,
    cambioDePuesto:
      c.puestoEnviado !== null && c.puestoEnviado !== claveDePuesto(puesto),
    verificadoAntes: false,
  };
}
