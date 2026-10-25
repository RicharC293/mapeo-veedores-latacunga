import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "../gestion/jsonStore";
import { listVeedores } from "../gestion/veedores";
import { listCoordinadores } from "../gestion/coordinadores";
import { listAcreditadosCda } from "../gestion/acreditadosCda";
import type { Json } from "../database.types";
import {
  PROVEEDOR,
  consultarCedula,
  type ResultadoConsulta,
} from "./ecuadorApi";
import { nombreOficial } from "./nombres";
import {
  nombreAntesDeAplicar,
  sePuedeConsultar,
  type ValidacionCedula,
} from "./plan";

const COLECCION = "validaciones_cedula";
// Tablas donde vive el nombre de una persona: al aplicar el nombre oficial se
// corrige en todas (la lista negra se deja tal cual).
const TABLAS = [
  "militantes",
  "veedores",
  "coordinadores",
  "acreditados_cda",
  "lideres",
] as const;
// Orden para tomar el nombre anterior: primero los puestos del Consolidado.
const TABLAS_PRIORIDAD = [
  "coordinadores",
  "acreditados_cda",
  "veedores",
  "militantes",
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
      fechaNacimiento: r.fecha_nacimiento,
      genero: r.genero,
      nombreMantenido: r.nombre_mantenido,
      nombreAnterior: r.nombre_anterior,
      nombreAplicadoEn: r.nombre_aplicado_en,
      respuesta: r.respuesta,
      httpStatus: r.http_status,
      error: r.error,
      intentos: r.intentos,
      proveedor: r.proveedor,
      consultadoEn: r.consultado_en,
    }));
  }
  return (await readCollection<ValidacionCedula>(COLECCION)).map((v) => ({
    ...v,
    fechaNacimiento: v.fechaNacimiento ?? null,
    genero: v.genero ?? null,
    nombreMantenido: v.nombreMantenido ?? false,
    nombreAnterior: v.nombreAnterior ?? null,
    nombreAplicadoEn: v.nombreAplicadoEn ?? null,
  }));
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
    fechaNacimiento: r.fechaNacimiento,
    genero: r.genero,
    nombreMantenido: false,
    nombreAnterior: anterior?.nombreAnterior ?? null,
    nombreAplicadoEn: anterior?.nombreAplicadoEn ?? null,
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
        fecha_nacimiento: v.fechaNacimiento,
        genero: v.genero,
        nombre_mantenido: v.nombreMantenido,
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

// Cédulas de quienes están en el Consolidado (veedores, coordinadores y
// acreditados CDA): el módulo solo consulta a esas personas.
export async function cedulasDelConsolidado(): Promise<Set<string>> {
  const [v, c, a] = await Promise.all([
    listVeedores(),
    listCoordinadores(),
    listAcreditadosCda(),
  ]);
  return new Set([...v, ...c, ...a].map((p) => p.cedula.trim()));
}

export interface ResultadoLote {
  consultadas: number;
  validadas: number;
  noEncontradas: number;
  conError: number;
  // Cédulas pedidas que no se consultaron: ya validadas, inválidas o fuera
  // del Consolidado (no se pagan).
  omitidas: number;
  // Motivo por el que se cortó el lote (clave, saldo, límite de la API).
  detenido: string | null;
}

// Consulta, de una en una, las cédulas pedidas que valga la pena consultar.
// Nunca repite una ya validada o no encontrada, así que se puede llamar varias
// veces sin pagar dos veces lo mismo.
export async function consultarCedulas(
  cedulas: string[],
  apiKey: string,
  urlBase?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ResultadoLote> {
  const [consolidado, validaciones] = await Promise.all([
    cedulasDelConsolidado(),
    listValidaciones(),
  ]);
  const anteriores = new Map(validaciones.map((v) => [v.cedula, v]));
  const unicas = [...new Set(cedulas.map((c) => c.trim()))];
  const aConsultar = unicas.filter(
    (c) => consolidado.has(c) && sePuedeConsultar(c, anteriores.get(c)),
  );
  const r: ResultadoLote = {
    consultadas: 0,
    validadas: 0,
    noEncontradas: 0,
    conError: 0,
    omitidas: unicas.length - aConsultar.length,
    detenido: null,
  };
  for (const cedula of aConsultar) {
    const resultado = await consultarCedula(cedula, apiKey, fetchFn, urlBase);
    if (resultado.detener) {
      // No se guarda: la consulta no llegó a responder sobre la cédula.
      r.detenido = resultado.error;
      break;
    }
    await guardarValidacion(cedula, resultado, anteriores.get(cedula));
    r.consultadas += 1;
    if (resultado.estado === "validada") r.validadas += 1;
    else if (resultado.estado === "no_encontrada") r.noEncontradas += 1;
    else r.conError += 1;
  }
  return r;
}

// Nombre de una cédula en cada tabla, en orden de prioridad (primero los
// puestos del Consolidado), para saber cuál era antes de cambiarlo.
async function nombresEnTablas(cedula: string): Promise<string[]> {
  const nombres: string[] = [];
  for (const tabla of TABLAS_PRIORIDAD) {
    if (supabaseSecret) {
      const { data, error } = await supabaseSecret
        .from(tabla)
        .select("nombres")
        .eq("cedula", cedula);
      if (error) throw new Error(error.message);
      nombres.push(...data.map((d) => d.nombres));
    } else {
      const items = await readCollection<{
        cedula: string | null;
        nombres: string;
      }>(tabla);
      nombres.push(
        ...items.filter((i) => i.cedula === cedula).map((i) => i.nombres),
      );
    }
  }
  return nombres;
}

async function escribirNombre(cedula: string, nombres: string): Promise<void> {
  for (const tabla of TABLAS) {
    if (supabaseSecret) {
      const { error } = await supabaseSecret
        .from(tabla)
        .update({ nombres })
        .eq("cedula", cedula);
      if (error) throw new Error(error.message);
    } else {
      await mutateCollection<{ cedula: string | null; nombres: string }>(
        tabla,
        (items) =>
          items.map((i) => (i.cedula === cedula ? { ...i, nombres } : i)),
      );
    }
  }
}

async function guardarNombreAnterior(
  cedula: string,
  nombreAnterior: string | null,
  nombreAplicadoEn: string | null,
): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("validaciones_cedula")
      .update({
        nombre_anterior: nombreAnterior,
        nombre_aplicado_en: nombreAplicadoEn,
      })
      .eq("cedula", cedula);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<ValidacionCedula>(COLECCION, (items) =>
    items.map((i) =>
      i.cedula === cedula ? { ...i, nombreAnterior, nombreAplicadoEn } : i,
    ),
  );
}

// Escribe el nombre oficial (formato del sistema) en todos los lugares donde
// consta cada cédula validada, guardando antes el nombre que tenía para poder
// deshacerlo.
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
    const anterior = nombreAntesDeAplicar(
      await nombresEnTablas(cedula),
      nombres,
    );
    if (anterior) {
      await guardarNombreAnterior(cedula, anterior, new Date().toISOString());
    }
    await escribirNombre(cedula, nombres);
    aplicadas += 1;
  }
  return aplicadas;
}

// Devuelve el nombre que tenía cada cédula antes de aplicar el oficial, en
// todos los lugares donde consta.
export async function deshacerNombres(cedulas: string[]): Promise<number> {
  const conAnterior = new Map(
    (await listValidaciones())
      .filter((v) => v.nombreAnterior)
      .map((v) => [v.cedula, v.nombreAnterior as string]),
  );
  let deshechas = 0;
  for (const cedula of new Set(cedulas)) {
    const anterior = conAnterior.get(cedula);
    if (!anterior) continue;
    await escribirNombre(cedula, anterior);
    await guardarNombreAnterior(cedula, null, null);
    deshechas += 1;
  }
  return deshechas;
}

// Conserva el nombre del sistema aunque difiera del oficial (por ejemplo, un
// nombre de uso habitual): la persona pasa a contar como verificada.
export async function mantenerNombres(cedulas: string[]): Promise<number> {
  const validadas = new Set(
    (await listValidaciones())
      .filter((v) => v.estado === "validada")
      .map((v) => v.cedula),
  );
  const lista = [...new Set(cedulas)].filter((c) => validadas.has(c));
  if (lista.length === 0) return 0;
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("validaciones_cedula")
      .update({ nombre_mantenido: true })
      .in("cedula", lista);
    if (error) throw new Error(error.message);
  } else {
    await mutateCollection<ValidacionCedula>(COLECCION, (items) =>
      items.map((i) =>
        lista.includes(i.cedula) ? { ...i, nombreMantenido: true } : i,
      ),
    );
  }
  return lista.length;
}
