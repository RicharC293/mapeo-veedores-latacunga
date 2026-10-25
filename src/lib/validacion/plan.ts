import { cedulaEcuatorianaValida } from "../gestion/validacionMilitante";
import { compararNombres, nombreOficial, type Coincidencia } from "./nombres";
import type { EstadoValidacion } from "./ecuadorApi";

// Lógica pura de la verificación de identidad del Consolidado: en qué estado
// está cada persona, qué cédulas se pueden consultar y los datos personales
// (edad, género) que trae la respuesta. Sin base ni API, para poder probarla.

export interface ValidacionCedula {
  cedula: string;
  estado: EstadoValidacion;
  nombres: string | null;
  apellidos: string | null;
  nombreCompleto: string | null;
  fechaNacimiento: string | null;
  genero: string | null;
  // El administrador decidió conservar el nombre del sistema.
  nombreMantenido: boolean;
  // Nombre que tenía antes de aplicar el oficial (para deshacer) y cuándo.
  nombreAnterior: string | null;
  nombreAplicadoEn: string | null;
  respuesta: unknown;
  httpStatus: number | null;
  error: string | null;
  intentos: number;
  proveedor: string;
  consultadoEn: string;
}

// sin_consultar: nunca se consultó. invalida: no pasa el dígito verificador
// (no se consulta). verificada: el nombre del sistema ya es el oficial (o se
// decidió mantenerlo). coincide: solo cambia el formato. revisar: el nombre es
// parecido o distinto. no_encontrada: la API no tiene esa cédula. error: falla
// técnica, se puede volver a consultar.
export type EstadoIdentidad =
  | "sin_consultar"
  | "invalida"
  | "verificada"
  | "coincide"
  | "revisar"
  | "no_encontrada"
  | "error";

export interface Identidad {
  estado: EstadoIdentidad;
  oficial: string | null;
  coincidencia: Coincidencia | null;
}

export function estadoIdentidad(
  nombre: string,
  cedula: string,
  v: ValidacionCedula | undefined,
): Identidad {
  if (v?.estado === "validada") {
    const oficial = nombreOficial(v.nombres, v.apellidos, v.nombreCompleto);
    if (nombre.trim() === oficial || v.nombreMantenido) {
      return { estado: "verificada", oficial, coincidencia: null };
    }
    const coincidencia = compararNombres(nombre, oficial);
    return {
      estado: coincidencia === "igual" ? "coincide" : "revisar",
      oficial,
      coincidencia,
    };
  }
  if (v?.estado === "no_encontrada") {
    return { estado: "no_encontrada", oficial: null, coincidencia: null };
  }
  if (!cedulaEcuatorianaValida(cedula.trim())) {
    return { estado: "invalida", oficial: null, coincidencia: null };
  }
  return {
    estado: v?.estado === "error" ? "error" : "sin_consultar",
    oficial: null,
    coincidencia: null,
  };
}

// ¿Vale la pena consultarla? Solo si nunca se consultó con éxito o dio un error
// técnico, y la cédula es válida (una inválida se cobraría igual).
export function sePuedeConsultar(
  cedula: string,
  v: ValidacionCedula | undefined,
): boolean {
  if (v && v.estado !== "error") return false;
  return cedulaEcuatorianaValida(cedula.trim());
}

const textoDe = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

// Fecha de nacimiento y género: de las columnas o, si faltan (registros
// guardados antes de tenerlas), del JSON de la respuesta.
export function datosPersonales(v: ValidacionCedula | undefined): {
  fechaNacimiento: string | null;
  genero: "masculino" | "femenino" | null;
} {
  if (!v || v.estado !== "validada") {
    return { fechaNacimiento: null, genero: null };
  }
  const data = (v.respuesta as { data?: Record<string, unknown> } | null)?.data;
  const fecha = v.fechaNacimiento ?? textoDe(data?.birth_date);
  const g = (v.genero ?? textoDe(data?.gender))?.toLowerCase();
  return {
    fechaNacimiento:
      fecha && /^\d{4}-\d{2}-\d{2}/.test(fecha) ? fecha.slice(0, 10) : null,
    genero:
      g === "male" || g === "masculino" || g === "m"
        ? "masculino"
        : g === "female" || g === "femenino" || g === "f"
          ? "femenino"
          : null,
  };
}

// Edad cumplida a la fecha dada (en hora de Ecuador basta el día).
export function edad(fechaNacimiento: string | null, hoy: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaNacimiento ?? "");
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let e = hoy.getFullYear() - anio;
  if (
    hoy.getMonth() + 1 < mes ||
    (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)
  ) {
    e -= 1;
  }
  return e >= 0 && e < 130 ? e : null;
}

export const ETIQUETA_GENERO = {
  masculino: "Masculino",
  femenino: "Femenino",
} as const;

// Nombre que se guarda como "anterior" al aplicar el oficial: el primero de
// los lugares donde consta (en orden de prioridad) que sea distinto del
// oficial. null si en todos ya está el oficial (no hay nada que deshacer).
export function nombreAntesDeAplicar(
  nombresEnTablas: (string | null | undefined)[],
  oficial: string,
): string | null {
  for (const n of nombresEnTablas) {
    const t = n?.trim();
    if (t && t !== oficial) return t;
  }
  return null;
}
