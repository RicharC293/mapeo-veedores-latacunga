import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { normalizarCedula } from "./cedula";
import { normalizarEmail } from "./email";
import { erroresMilitante, esIncorrecto } from "./validacionMilitante";
import { rowToMilitante } from "./rows";
import { agregarVeedor, veedoresPorJunta } from "./veedores";
import { agregarCoordinador, coordinadoresPorRecinto } from "./coordinadores";
import {
  agregarAcreditadoCda,
  acreditadosCdaPorRecinto,
} from "./acreditadosCda";
import { juntaId } from "./juntas";
import type {
  AcreditadoCda,
  Coordinador,
  Genero,
  Militante,
  TipoMilitancia,
  Veedor,
} from "./types";

const COLLECTION = "militantes";

type MilitanteSinDuplicado = Omit<Militante, "duplicado" | "incorrecto">;

function esFilaIncorrecta(f: MilitanteSinDuplicado): boolean {
  return esIncorrecto(erroresMilitante(f));
}

// Devuelve la fila con sus banderas calculadas (duplicado, incorrecto).
function conBanderas(f: MilitanteSinDuplicado): Militante {
  return { ...f, duplicado: false, incorrecto: esFilaIncorrecta(f) };
}

// Pura para poder probarla aparte: marca como duplicada cualquier fila cuya
// cédula se repite dentro del propio lote de Militancia (no contra
// veedores/coordinadores/acreditados_cda: esas tablas ya rechazan una
// cédula repetida al asignar, con su propio mensaje de error).
export function marcarDuplicados(filas: MilitanteSinDuplicado[]): Militante[] {
  const cuenta = new Map<string, number>();
  for (const f of filas) cuenta.set(f.cedula, (cuenta.get(f.cedula) ?? 0) + 1);
  return filas.map((f) => ({
    ...f,
    duplicado: (cuenta.get(f.cedula) ?? 0) > 1,
    incorrecto: esFilaIncorrecta(f),
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
  return marcarDuplicados(filas);
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
  Pick<Militante, "cedula" | "nombres" | "telefono" | "email" | "preferencia">
>;

// Corrige los datos básicos de una fila de Militancia (cédula mal digitada,
// correo con error, etc.) sin tener que borrarla y volver a cargarla. No
// rechaza datos mal formados: la fila sigue marcada como incorrecta hasta que
// quede bien.
export async function editarMilitante(
  id: string,
  patch: MilitantePatch,
): Promise<Militante> {
  const cambios: MilitantePatch = {};
  if (patch.cedula !== undefined)
    cambios.cedula = normalizarCedula(patch.cedula);
  if (patch.nombres !== undefined) cambios.nombres = patch.nombres.trim();
  if (patch.telefono !== undefined) cambios.telefono = patch.telefono.trim();
  if (patch.email !== undefined) cambios.email = normalizarEmail(patch.email);
  if (patch.preferencia !== undefined)
    cambios.preferencia = patch.preferencia.trim();

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("militantes")
      .update(cambios)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return conBanderas(rowToMilitante(data));
  }

  let editado: MilitanteSinDuplicado | null = null;
  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) => {
    const actual = items.find((f) => f.id === id);
    if (!actual) throw new Error("No se encontró el militante.");
    editado = { ...actual, ...cambios };
    return items.map((f) => (f.id === id ? editado! : f));
  });
  return conBanderas(editado!);
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
}

export type AsignarDestino =
  | {
      tipo: "veedor";
      recintoCodigo: number;
      parroquiaCodigo: number;
      genero: Genero;
      numero: number;
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
  | { estado: "confirmar"; titular: string }
  | { estado: "lleno"; titular: string; suplente: string };

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

  // Quién ocupa hoy el lugar de destino.
  const junta =
    destino.tipo === "veedor"
      ? juntaId(destino.recintoCodigo, destino.genero, destino.numero)
      : "";
  const ocupantes =
    destino.tipo === "veedor"
      ? await veedoresPorJunta(junta)
      : destino.tipo === "coordinador"
        ? await coordinadoresPorRecinto(destino.recintoCodigo)
        : await acreditadosCdaPorRecinto(destino.recintoCodigo);

  let rol: "titular" | "suplente" = "titular";
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
