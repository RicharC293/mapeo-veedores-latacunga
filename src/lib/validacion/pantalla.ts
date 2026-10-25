import { listVeedores } from "../gestion/veedores";
import { listCoordinadores } from "../gestion/coordinadores";
import { listAcreditadosCda } from "../gestion/acreditadosCda";
import { COSTO_POR_CONSULTA } from "./ecuadorApi";
import { listValidaciones } from "./validaciones";
import {
  datosPersonales,
  estadoIdentidad,
  type EstadoIdentidad,
  type ValidacionCedula,
} from "./plan";
import type { Coincidencia } from "./nombres";

// Una fila por persona del Consolidado, con su estado de verificación y los
// datos que trae el Registro Civil. Solo para administradores.
export interface FilaVerificacion {
  id: string;
  cedula: string;
  nombres: string;
  rol: "veedor" | "coordinador" | "cda";
  tipo: "titular" | "suplente";
  recintoCodigo: number;
  parroquiaCodigo: number;
  // Etiqueta de la junta ("F12"), solo para veedores.
  junta: string | null;
  estado: EstadoIdentidad;
  oficial: string | null;
  coincidencia: Coincidencia | null;
  fechaNacimiento: string | null;
  genero: "masculino" | "femenino" | null;
  error: string | null;
  // Nombre que tenía antes de aplicar el oficial (se puede deshacer).
  nombreAnterior: string | null;
  respuesta: unknown;
}

export interface DatosVerificacion {
  costoPorConsulta: number;
  filas: FilaVerificacion[];
}

export async function datosVerificacion(): Promise<DatosVerificacion> {
  const [veedores, coordinadores, acreditados, validaciones] =
    await Promise.all([
      listVeedores(),
      listCoordinadores(),
      listAcreditadosCda(),
      listValidaciones(),
    ]);
  const porCedula = new Map<string, ValidacionCedula>(
    validaciones.map((v) => [v.cedula, v]),
  );
  const fila = (
    p: {
      id: string;
      cedula: string;
      nombres: string;
      tipo: "titular" | "suplente";
      recintoCodigo: number;
      parroquiaCodigo: number;
    },
    rol: FilaVerificacion["rol"],
    junta: string | null,
  ): FilaVerificacion => {
    const v = porCedula.get(p.cedula.trim());
    const identidad = estadoIdentidad(p.nombres, p.cedula, v);
    return {
      id: p.id,
      cedula: p.cedula,
      nombres: p.nombres,
      rol,
      tipo: p.tipo,
      recintoCodigo: p.recintoCodigo,
      parroquiaCodigo: p.parroquiaCodigo,
      junta,
      ...identidad,
      ...datosPersonales(v),
      error: v?.estado === "validada" ? null : (v?.error ?? null),
      nombreAnterior: v?.nombreAnterior ?? null,
      respuesta: v?.respuesta ?? null,
    };
  };
  return {
    costoPorConsulta: COSTO_POR_CONSULTA,
    filas: [
      ...coordinadores.map((c) => fila(c, "coordinador", null)),
      ...acreditados.map((a) => fila(a, "cda", null)),
      ...veedores.map((v) =>
        fila(v, "veedor", v.juntaId.slice(v.juntaId.lastIndexOf("-") + 1)),
      ),
    ],
  };
}

// Lo que el Consolidado muestra de cada cédula validada: si la identidad está
// verificada (o el nombre por revisar), la fecha de nacimiento y el género.
export interface IdentidadConsolidado {
  verificada: boolean;
  porRevisar: boolean;
  fechaNacimiento: string | null;
  genero: "masculino" | "femenino" | null;
}

export function identidadPorCedula(
  personas: { cedula: string; nombres: string }[],
  validaciones: ValidacionCedula[],
): Record<string, IdentidadConsolidado> {
  const porCedula = new Map(validaciones.map((v) => [v.cedula, v]));
  const resultado: Record<string, IdentidadConsolidado> = {};
  for (const p of personas) {
    const v = porCedula.get(p.cedula.trim());
    if (v?.estado !== "validada") continue;
    const { estado } = estadoIdentidad(p.nombres, p.cedula, v);
    resultado[p.cedula.trim()] = {
      verificada: estado === "verificada",
      porRevisar: estado === "coincide" || estado === "revisar",
      ...datosPersonales(v),
    };
  }
  return resultado;
}
