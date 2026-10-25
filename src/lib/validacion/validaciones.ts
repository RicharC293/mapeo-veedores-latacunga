import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "../gestion/jsonStore";
import { listMilitantes } from "../gestion/militancia";
import { listVeedores } from "../gestion/veedores";
import { listCoordinadores } from "../gestion/coordinadores";
import { listAcreditadosCda } from "../gestion/acreditadosCda";
import { listLideres } from "../gestion/lideres";
import type { Json } from "../database.types";
import {
  PROVEEDOR,
  consultarCedula,
  type ResultadoConsulta,
} from "./ecuadorApi";
import { nombreOficial } from "./nombres";
import {
  agruparPersonas,
  resumirValidacion,
  type PersonaRegistrada,
  type ValidacionCedula,
} from "./plan";

const COLECCION = "validaciones_cedula";
// Tablas donde vive el nombre de una persona (la lista negra se deja tal cual).
const TABLAS = [
  "militantes",
  "veedores",
  "coordinadores",
  "acreditados_cda",
  "lideres",
] as const;

export async function listValidaciones(): Promise<ValidacionCedula[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("validaciones_cedula")
      .select("*");
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      cedula: r.cedula,
      estado: r.estado as ValidacionCedula["estado"],
      nombres: r.nombres,
      apellidos: r.apellidos,
      nombreCompleto: r.nombre_completo,
      respuesta: r.respuesta,
      httpStatus: r.http_status,
      error: r.error,
      intentos: r.intentos,
      proveedor: r.proveedor,
      consultadoEn: r.consultado_en,
    }));
  }
  return readCollection<ValidacionCedula>(COLECCION);
}

async function guardarValidacion(
  cedula: string,
  r: ResultadoConsulta,
  anterior: ValidacionCedula | undefined,
): Promise<void> {
  const v: ValidacionCedula = {
    cedula,
    estado: r.estado,
    nombres: r.nombres,
    apellidos: r.apellidos,
    nombreCompleto: r.nombreCompleto,
    respuesta: r.respuesta,
    httpStatus: r.httpStatus,
    error: r.error,
    intentos: (anterior?.intentos ?? 0) + 1,
    proveedor: PROVEEDOR,
    consultadoEn: new Date().toISOString(),
  };
  if (supabaseSecret) {
    const { error } = await supabaseSecret.from("validaciones_cedula").upsert(
      {
        cedula: v.cedula,
        estado: v.estado,
        nombres: v.nombres,
        apellidos: v.apellidos,
        nombre_completo: v.nombreCompleto,
        respuesta: (v.respuesta ?? null) as Json,
        http_status: v.httpStatus,
        error: v.error,
        intentos: v.intentos,
        proveedor: v.proveedor,
        consultado_en: v.consultadoEn,
      },
      { onConflict: "cedula" },
    );
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<ValidacionCedula>(COLECCION, (items) => [
    ...items.filter((i) => i.cedula !== cedula),
    v,
  ]);
}

// Todas las personas del sistema, una por cédula, con dónde constan.
export async function listarPersonasRegistradas(): Promise<
  PersonaRegistrada[]
> {
  const [militantes, veedores, coordinadores, acreditados, lideres] =
    await Promise.all([
      listMilitantes(),
      listVeedores(),
      listCoordinadores(),
      listAcreditadosCda(),
      listLideres(),
    ]);
  return agruparPersonas([
    { donde: "Coordinador", personas: coordinadores },
    { donde: "Acreditado CDA", personas: acreditados },
    { donde: "Veedor", personas: veedores },
    { donde: "Líder", personas: lideres },
    { donde: "Militancia", personas: militantes },
  ]);
}

export async function resumenValidacion() {
  const [personas, validaciones] = await Promise.all([
    listarPersonasRegistradas(),
    listValidaciones(),
  ]);
  return { resumen: resumirValidacion(personas, validaciones), validaciones };
}

export interface ResultadoLote {
  consultadas: number;
  validadas: number;
  noEncontradas: number;
  conError: number;
  // Motivo por el que se cortó el lote antes de tiempo (clave, saldo, límite).
  detenido: string | null;
  pendientes: number;
}

// Consulta, de una en una, hasta `limite` cédulas pendientes. Nunca repite una
// cédula ya validada o no encontrada, así que se puede llamar varias veces sin
// pagar dos veces lo mismo.
export async function consultarPendientes(
  limite: number,
  apiKey: string,
  urlBase?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ResultadoLote> {
  const { resumen, validaciones } = await resumenValidacion();
  const anteriores = new Map(validaciones.map((v) => [v.cedula, v]));
  const lote = resumen.pendientes.slice(0, Math.max(0, limite));
  const r: ResultadoLote = {
    consultadas: 0,
    validadas: 0,
    noEncontradas: 0,
    conError: 0,
    detenido: null,
    pendientes: resumen.pendientes.length,
  };
  for (const p of lote) {
    const resultado = await consultarCedula(p.cedula, apiKey, fetchFn, urlBase);
    if (resultado.detener) {
      // No se guarda: la consulta no llegó a responder sobre la cédula.
      r.detenido = resultado.error;
      break;
    }
    await guardarValidacion(p.cedula, resultado, anteriores.get(p.cedula));
    r.consultadas += 1;
    if (resultado.estado === "validada") r.validadas += 1;
    else if (resultado.estado === "no_encontrada") r.noEncontradas += 1;
    else r.conError += 1;
  }
  r.pendientes = Math.max(0, r.pendientes - r.validadas - r.noEncontradas);
  return r;
}

// Escribe el nombre oficial (formato del sistema) en todos los lugares donde
// consta cada cédula validada.
export async function aplicarNombresOficiales(
  cedulas: string[],
): Promise<number> {
  const validaciones = new Map(
    (await listValidaciones())
      .filter((v) => v.estado === "validada")
      .map((v) => [v.cedula, v]),
  );
  let aplicadas = 0;
  for (const cedula of new Set(cedulas)) {
    const v = validaciones.get(cedula);
    if (!v) continue;
    const nombres = nombreOficial(v.nombres, v.apellidos, v.nombreCompleto);
    if (!nombres) continue;
    if (supabaseSecret) {
      for (const tabla of TABLAS) {
        const { error } = await supabaseSecret
          .from(tabla)
          .update({ nombres })
          .eq("cedula", cedula);
        if (error) throw new Error(error.message);
      }
    } else {
      for (const tabla of TABLAS) {
        await mutateCollection<{ cedula: string | null; nombres: string }>(
          tabla,
          (items) =>
            items.map((i) => (i.cedula === cedula ? { ...i, nombres } : i)),
        );
      }
    }
    aplicadas += 1;
  }
  return aplicadas;
}
