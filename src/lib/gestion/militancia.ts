import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { normalizarCedula } from "./cedula";
import { normalizarEmail } from "./email";
import { erroresMilitante, esIncorrecto } from "./validacionMilitante";
import { recintoDePreferencia } from "./recintoPreferencia";
import type { ParroquiaFeature, Recinto } from "../types";
import { rowToMilitante } from "./rows";
import { agregarVeedor, listVeedores, veedoresPorJunta } from "./veedores";
import { agregarCoordinador, coordinadoresPorRecinto } from "./coordinadores";
import {
  agregarAcreditadoCda,
  acreditadosCdaPorRecinto,
} from "./acreditadosCda";
import { juntaId } from "./juntas";
import { elegirJuntaAutomatica } from "./juntaAutomatica";
import { listLideres } from "./lideres";
import type {
  AcreditadoCda,
  CambioMilitante,
  Coordinador,
  EdicionMilitante,
  Genero,
  Militante,
  TipoMilitancia,
  Veedor,
} from "./types";

const COLLECTION = "militantes";
const COLECCION_HISTORIAL = "militantes_historial";

// Fila tal como se guarda: sin las banderas que se calculan al leer.
type MilitanteSinDuplicado = Omit<
  Militante,
  "duplicado" | "incorrecto" | "ediciones"
>;

function esFilaIncorrecta(f: MilitanteSinDuplicado): boolean {
  return esIncorrecto(erroresMilitante(f));
}

// Devuelve la fila con sus banderas calculadas (duplicado, incorrecto).
function conBanderas(f: MilitanteSinDuplicado): Militante {
  return {
    ...f,
    duplicado: false,
    incorrecto: esFilaIncorrecta(f),
    ediciones: 0,
  };
}

// Pura para poder probarla aparte: marca como duplicada cualquier fila cuya
// cédula se repite dentro del propio lote de Militancia (no contra
// veedores/coordinadores/acreditados_cda: esas tablas ya rechazan una
// cédula repetida al asignar, con su propio mensaje de error).
export function marcarDuplicados(
  filas: MilitanteSinDuplicado[],
  ediciones: Map<string, number> = new Map(),
): Militante[] {
  const cuenta = new Map<string, number>();
  for (const f of filas) cuenta.set(f.cedula, (cuenta.get(f.cedula) ?? 0) + 1);
  return filas.map((f) => ({
    ...f,
    duplicado: (cuenta.get(f.cedula) ?? 0) > 1,
    incorrecto: esFilaIncorrecta(f),
    ediciones: ediciones.get(f.id) ?? 0,
  }));
}

export async function listMilitantes(): Promise<Militante[]> {
  let filas: MilitanteSinDuplicado[];
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret.from("militantes").select("*");
    if (error) throw new Error(error.message);
    filas = data.map(rowToMilitante);
  } else {
    filas = await readCollection<MilitanteSinDuplicado>(COLLECTION);
  }
  return marcarDuplicados(filas, await contarEdiciones());
}

// Cuántas ediciones tiene registradas cada militante (para mostrar el enlace
// "Ver historial" solo en las tarjetas que lo tienen).
async function contarEdiciones(): Promise<Map<string, number>> {
  const cuenta = new Map<string, number>();
  let ids: string[];
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("militantes_historial")
      .select("militante_id");
    if (error) throw new Error(error.message);
    ids = data.map((r) => r.militante_id);
  } else {
    ids = (await readCollection<EdicionMilitante>(COLECCION_HISTORIAL)).map(
      (e) => e.militanteId,
    );
  }
  for (const id of ids) cuenta.set(id, (cuenta.get(id) ?? 0) + 1);
  return cuenta;
}

// Ediciones de una persona, de la más reciente a la más antigua.
export async function historialDeMilitante(
  id: string,
): Promise<EdicionMilitante[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("militantes_historial")
      .select("*")
      .eq("militante_id", id)
      .order("creado_en", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      id: r.id,
      militanteId: r.militante_id,
      usuario: r.usuario,
      cambios: r.cambios as unknown as CambioMilitante[],
      creadoEn: r.creado_en,
    }));
  }
  return (await readCollection<EdicionMilitante>(COLECCION_HISTORIAL))
    .filter((e) => e.militanteId === id)
    .sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn));
}

async function registrarEdicion(
  militanteId: string,
  usuario: string,
  cambios: CambioMilitante[],
): Promise<void> {
  if (cambios.length === 0) return;
  if (supabaseSecret) {
    const { error } = await supabaseSecret.from("militantes_historial").insert({
      militante_id: militanteId,
      usuario,
      cambios: cambios as unknown as never,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const edicion: EdicionMilitante = {
    id: randomUUID(),
    militanteId,
    usuario,
    cambios,
    creadoEn: new Date().toISOString(),
  };
  await mutateCollection<EdicionMilitante>(COLECCION_HISTORIAL, (items) => [
    ...items,
    edicion,
  ]);
}

async function obtenerMilitante(
  id: string,
): Promise<MilitanteSinDuplicado | null> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("militantes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToMilitante(data) : null;
  }
  const filas = await readCollection<MilitanteSinDuplicado>(COLLECTION);
  return filas.find((f) => f.id === id) ?? null;
}

export async function agregarMilitante(input: {
  cedula: string;
  nombres: string;
  telefono: string;
  email?: string;
  preferencia?: string;
  // Recinto/parroquia reconocidos a partir de la preferencia (los resuelve
  // la ruta API, que conoce los recintos); sin ellos la fila queda sin
  // preasignar.
  recintoCodigo?: number | null;
  parroquiaCodigo?: number | null;
  responsableLiderId: string | null;
}): Promise<Militante> {
  const cedula = normalizarCedula(input.cedula);
  const nombres = input.nombres.trim();
  // Los datos mal formados se cargan igual y quedan marcados como
  // incorrectos; solo se rechaza una fila totalmente vacía.
  if (!cedula && !nombres) {
    throw new Error("Ingresa al menos la cédula o el nombre.");
  }

  const nueva: MilitanteSinDuplicado = {
    id: randomUUID(),
    cedula,
    nombres,
    telefono: input.telefono.trim(),
    email: normalizarEmail(input.email),
    preferencia: (input.preferencia ?? "").trim(),
    responsableLiderId: input.responsableLiderId,
    recintoCodigo: input.recintoCodigo ?? null,
    parroquiaCodigo: input.parroquiaCodigo ?? null,
    tipoPreasignado: null,
    juntaPreasignada: null,
    creadoEn: new Date().toISOString(),
  };

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("militantes")
      .insert({
        cedula: nueva.cedula,
        nombres: nueva.nombres,
        telefono: nueva.telefono,
        email: nueva.email,
        preferencia: nueva.preferencia,
        recinto_codigo: nueva.recintoCodigo,
        parroquia_codigo: nueva.parroquiaCodigo,
        responsable_lider_id: nueva.responsableLiderId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return conBanderas(rowToMilitante(data));
  }

  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) => [
    ...items,
    nueva,
  ]);
  return conBanderas(nueva);
}

export async function importarMilitantes(input: {
  responsableLiderId: string;
  recintoCodigo?: number;
  parroquiaCodigo?: number;
  tipoPreasignado?: TipoMilitancia;
  filas: {
    cedula: string;
    nombres: string;
    telefono: string;
    email?: string;
    preferencia?: string;
    // Reconocidos por la ruta API a partir de la preferencia de esta fila.
    recintoCodigo?: number | null;
    parroquiaCodigo?: number | null;
  }[];
}): Promise<{
  creados: number;
  omitidos: number;
  incorrectos: number;
  precargados: number;
}> {
  if (!input.responsableLiderId) {
    throw new Error("Debes elegir un responsable antes de importar.");
  }

  const validas: MilitanteSinDuplicado[] = [];
  let omitidos = 0;
  for (const fila of input.filas) {
    const cedula = normalizarCedula(fila.cedula ?? "");
    const nombres = (fila.nombres ?? "").trim();
    // Se carga todo tal como viene; solo se omiten las filas sin cédula ni
    // nombre (líneas vacías). Lo mal formado queda marcado como incorrecto.
    if (!cedula && !nombres) {
      omitidos += 1;
      continue;
    }
    validas.push({
      id: randomUUID(),
      cedula,
      nombres,
      telefono: (fila.telefono ?? "").trim(),
      email: normalizarEmail(fila.email),
      responsableLiderId: input.responsableLiderId,
      preferencia: (fila.preferencia ?? "").trim(),
      // El destino elegido para todo el lote manda; si no hay, se usa el que
      // se reconoció de la preferencia de esta fila.
      recintoCodigo: input.recintoCodigo ?? fila.recintoCodigo ?? null,
      parroquiaCodigo: input.parroquiaCodigo ?? fila.parroquiaCodigo ?? null,
      tipoPreasignado: input.tipoPreasignado ?? null,
      juntaPreasignada: null,
      creadoEn: new Date().toISOString(),
    });
  }
  const incorrectos = validas.filter(esFilaIncorrecta).length;
  const precargados = validas.filter((v) => v.recintoCodigo !== null).length;

  if (validas.length === 0)
    return { creados: 0, omitidos, incorrectos, precargados };

  if (supabaseSecret) {
    const { error } = await supabaseSecret.from("militantes").insert(
      validas.map((v) => ({
        cedula: v.cedula,
        nombres: v.nombres,
        telefono: v.telefono,
        email: v.email,
        preferencia: v.preferencia,
        responsable_lider_id: v.responsableLiderId,
        recinto_codigo: v.recintoCodigo,
        parroquia_codigo: v.parroquiaCodigo,
        tipo_preasignado: v.tipoPreasignado,
      })),
    );
    if (error) throw new Error(error.message);
    return { creados: validas.length, omitidos, incorrectos, precargados };
  }

  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) => [
    ...items,
    ...validas,
  ]);
  return { creados: validas.length, omitidos, incorrectos, precargados };
}

export type MilitantePatch = Partial<
  Pick<
    Militante,
    | "cedula"
    | "nombres"
    | "telefono"
    | "email"
    | "preferencia"
    | "responsableLiderId"
  >
>;

// Corrige los datos básicos de una fila de Militancia (cédula mal digitada,
// correo con error, etc.) sin tener que borrarla y volver a cargarla. No
// rechaza datos mal formados: la fila sigue marcada como incorrecta hasta que
// quede bien.
export async function editarMilitante(
  id: string,
  patch: MilitantePatch,
  usuario = "",
): Promise<Militante> {
  const cambios: MilitantePatch = {};
  if (patch.cedula !== undefined)
    cambios.cedula = normalizarCedula(patch.cedula);
  if (patch.nombres !== undefined) cambios.nombres = patch.nombres.trim();
  if (patch.telefono !== undefined) cambios.telefono = patch.telefono.trim();
  if (patch.email !== undefined) cambios.email = normalizarEmail(patch.email);
  if (patch.preferencia !== undefined)
    cambios.preferencia = patch.preferencia.trim();
  // null = sin responsable.
  if (patch.responsableLiderId !== undefined)
    cambios.responsableLiderId = patch.responsableLiderId || null;

  // Qué cambia respecto de lo guardado, para el historial.
  const anterior = await obtenerMilitante(id);
  if (!anterior) throw new Error("No se encontró el militante.");
  const lideres = await listLideres();
  const nombreLider = (lid: string | null) =>
    lideres.find((l) => l.id === lid)?.nombres ?? "";
  const diff: CambioMilitante[] = [];
  const comparar = (campo: string, antes: string, despues: string) => {
    if (antes !== despues) diff.push({ campo, antes, despues });
  };
  if (cambios.cedula !== undefined)
    comparar("Cédula", anterior.cedula, cambios.cedula);
  if (cambios.nombres !== undefined)
    comparar("Nombres", anterior.nombres, cambios.nombres);
  if (cambios.telefono !== undefined)
    comparar("Celular", anterior.telefono, cambios.telefono);
  if (cambios.email !== undefined)
    comparar("Correo", anterior.email, cambios.email);
  if (cambios.preferencia !== undefined)
    comparar("Preferencia", anterior.preferencia, cambios.preferencia);
  if (cambios.responsableLiderId !== undefined)
    comparar(
      "Responsable",
      nombreLider(anterior.responsableLiderId),
      nombreLider(cambios.responsableLiderId),
    );

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("militantes")
      .update({
        ...(cambios.cedula !== undefined && { cedula: cambios.cedula }),
        ...(cambios.nombres !== undefined && { nombres: cambios.nombres }),
        ...(cambios.telefono !== undefined && { telefono: cambios.telefono }),
        ...(cambios.email !== undefined && { email: cambios.email }),
        ...(cambios.preferencia !== undefined && {
          preferencia: cambios.preferencia,
        }),
        ...(cambios.responsableLiderId !== undefined && {
          responsable_lider_id: cambios.responsableLiderId,
        }),
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await registrarEdicion(id, usuario, diff);
    return conBanderas(rowToMilitante(data));
  }

  let editado: MilitanteSinDuplicado | null = null;
  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) => {
    const actual = items.find((f) => f.id === id);
    if (!actual) throw new Error("No se encontró el militante.");
    editado = { ...actual, ...cambios };
    return items.map((f) => (f.id === id ? editado! : f));
  });
  await registrarEdicion(id, usuario, diff);
  return conBanderas(editado!);
}

// Completa Parroquia y Recinto de las filas que no los tienen y cuya
// Preferencia se reconoce como un único recinto. Sirve para filas cargadas
// antes de que el reconocimiento mejorara. Nunca pisa un recinto ya elegido.
export async function autocompletarRecintos(
  recintos: Recinto[],
  parroquias: ParroquiaFeature[],
): Promise<{ actualizados: number }> {
  const pendientes = (await listMilitantes()).filter(
    (m) => m.recintoCodigo === null && m.preferencia.trim() !== "",
  );
  const destino = new Map<string, { recinto: number; parroquia: number }>();
  for (const m of pendientes) {
    const r = recintoDePreferencia(m.preferencia, recintos, parroquias);
    if (r) destino.set(m.id, { recinto: r.cod, parroquia: r.par });
  }
  if (destino.size === 0) return { actualizados: 0 };

  if (supabaseSecret) {
    for (const [id, d] of destino) {
      const { error } = await supabaseSecret
        .from("militantes")
        .update({ recinto_codigo: d.recinto, parroquia_codigo: d.parroquia })
        .eq("id", id)
        .is("recinto_codigo", null);
      if (error) throw new Error(error.message);
    }
    return { actualizados: destino.size };
  }

  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) =>
    items.map((f) => {
      const d = destino.get(f.id);
      return d && f.recintoCodigo === null
        ? { ...f, recintoCodigo: d.recinto, parroquiaCodigo: d.parroquia }
        : f;
    }),
  );
  return { actualizados: destino.size };
}

export async function eliminarMilitante(id: string): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("militantes")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) =>
    items.filter((f) => f.id !== id),
  );
  // Respaldo local de ON DELETE CASCADE: el historial se va con la persona.
  await mutateCollection<EdicionMilitante>(COLECCION_HISTORIAL, (items) =>
    items.filter((e) => e.militanteId !== id),
  );
}

export type AsignarDestino =
  | {
      tipo: "veedor";
      recintoCodigo: number;
      parroquiaCodigo: number;
      genero: Genero;
      // Sin número, la junta se elige sola entre las del género indicado
      // (ver juntaAutomatica.ts); la ruta API pasa sus ids en juntaIds.
      numero?: number;
      juntaIds?: string[];
    }
  | { tipo: "coordinador"; recintoCodigo: number; parroquiaCodigo: number }
  | { tipo: "cda"; recintoCodigo: number; parroquiaCodigo: number };

// Cada junta (veedor) y cada recinto (coordinador, CDA) admite un titular y
// un solo suplente. Asignar a un lugar con titular exige confirmar que la
// persona quedará como suplente; si el suplente también está ocupado, no hay
// cupo y no se asigna.
export type ResultadoAsignacion =
  | {
      estado: "asignado";
      rol: "titular" | "suplente";
      persona: Veedor | Coordinador | AcreditadoCda;
    }
  | {
      estado: "confirmar";
      titular: string;
      // Elección automática: la junta donde quedaría como suplente.
      automatico?: boolean;
      junta?: string;
    }
  | {
      estado: "lleno";
      titular: string;
      suplente: string;
      // Elección automática: ninguna junta del género tiene cupo.
      automatico?: boolean;
    };

export async function asignarMilitante(
  id: string,
  destino: AsignarDestino,
  confirmarSuplente = false,
): Promise<ResultadoAsignacion> {
  const militante = await obtenerMilitante(id);
  if (!militante) throw new Error("No se encontró el militante.");
  // Requisitos para asignar: cédula válida, teléfono de 10 dígitos, correo
  // válido y cédula no repetida en la bandeja.
  if (esFilaIncorrecta(militante)) {
    throw new Error(
      "Corrige los datos marcados en rojo antes de asignar a esta persona.",
    );
  }
  const hayRepetida = (await listMilitantes()).some(
    (m) => m.id === id && m.duplicado,
  );
  if (hayRepetida) {
    throw new Error(
      "Esta cédula está repetida en Militancia: elimina o corrige una de las filas antes de asignar.",
    );
  }

  let rol: "titular" | "suplente" = "titular";
  let junta: string;

  if (destino.tipo === "veedor" && destino.numero == null) {
    // Junta automática: titulares primero y, completos, suplentes.
    const eleccion = elegirJuntaAutomatica(
      destino.juntaIds ?? [],
      await listVeedores(),
    );
    if (eleccion.estado === "sin_juntas") {
      throw new Error("Este recinto no tiene juntas de ese género.");
    }
    if (eleccion.estado === "lleno") {
      return { estado: "lleno", titular: "", suplente: "", automatico: true };
    }
    junta = eleccion.juntaId;
    if (eleccion.estado === "suplente") {
      if (!confirmarSuplente) {
        return {
          estado: "confirmar",
          titular: eleccion.titular,
          automatico: true,
          junta,
        };
      }
      rol = "suplente";
    }
  } else {
    // Quién ocupa hoy el lugar de destino.
    junta =
      destino.tipo === "veedor"
        ? juntaId(destino.recintoCodigo, destino.genero, destino.numero!)
        : "";
    const ocupantes =
      destino.tipo === "veedor"
        ? await veedoresPorJunta(junta)
        : destino.tipo === "coordinador"
          ? await coordinadoresPorRecinto(destino.recintoCodigo)
          : await acreditadosCdaPorRecinto(destino.recintoCodigo);

    if (ocupantes.titular) {
      if (ocupantes.suplentes.length > 0) {
        return {
          estado: "lleno",
          titular: ocupantes.titular.nombres,
          suplente: ocupantes.suplentes[0].nombres,
        };
      }
      if (!confirmarSuplente) {
        return { estado: "confirmar", titular: ocupantes.titular.nombres };
      }
      rol = "suplente";
    }
  }

  const base = {
    cedula: militante.cedula,
    nombres: militante.nombres,
    telefono: militante.telefono,
    email: militante.email,
    responsableLiderId: militante.responsableLiderId,
    recintoCodigo: destino.recintoCodigo,
    parroquiaCodigo: destino.parroquiaCodigo,
    tipo: rol,
  };

  let persona: Veedor | Coordinador | AcreditadoCda;
  if (destino.tipo === "veedor") {
    persona = await agregarVeedor({ ...base, juntaId: junta });
  } else if (destino.tipo === "coordinador") {
    persona = await agregarCoordinador(base);
  } else {
    persona = await agregarAcreditadoCda(base);
  }

  await eliminarMilitante(id);
  return { estado: "asignado", rol, persona };
}
