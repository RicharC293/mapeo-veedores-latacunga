import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { cedulaValida, normalizarCedula } from "./cedula";
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

type MilitanteSinDuplicado = Omit<Militante, "duplicado">;

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

async function obtenerMilitante(id: string): Promise<MilitanteSinDuplicado | null> {
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
  responsableLiderId: string | null;
}): Promise<Militante> {
  const cedula = normalizarCedula(input.cedula);
  if (!cedulaValida(cedula))
    throw new Error("Cédula inválida: debe tener 10 dígitos.");
  if (!input.nombres.trim()) throw new Error("El nombre es obligatorio.");

  const nueva: MilitanteSinDuplicado = {
    id: randomUUID(),
    cedula,
    nombres: input.nombres.trim(),
    telefono: input.telefono.trim(),
    responsableLiderId: input.responsableLiderId,
    recintoCodigo: null,
    parroquiaCodigo: null,
    tipoPreasignado: null,
    creadoEn: new Date().toISOString(),
  };

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("militantes")
      .insert({
        cedula: nueva.cedula,
        nombres: nueva.nombres,
        telefono: nueva.telefono,
        responsable_lider_id: nueva.responsableLiderId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...rowToMilitante(data), duplicado: false };
  }

  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) => [
    ...items,
    nueva,
  ]);
  return { ...nueva, duplicado: false };
}

export async function importarMilitantes(input: {
  responsableLiderId: string;
  recintoCodigo?: number;
  parroquiaCodigo?: number;
  tipoPreasignado?: TipoMilitancia;
  filas: { cedula: string; nombres: string; telefono: string }[];
}): Promise<{ creados: number; omitidos: number }> {
  if (!input.responsableLiderId) {
    throw new Error("Debes elegir un responsable antes de importar.");
  }

  const validas: MilitanteSinDuplicado[] = [];
  let omitidos = 0;
  for (const fila of input.filas) {
    const cedula = normalizarCedula(fila.cedula ?? "");
    const nombres = (fila.nombres ?? "").trim();
    if (!cedulaValida(cedula) || !nombres) {
      omitidos += 1;
      continue;
    }
    validas.push({
      id: randomUUID(),
      cedula,
      nombres,
      telefono: (fila.telefono ?? "").trim(),
      responsableLiderId: input.responsableLiderId,
      recintoCodigo: input.recintoCodigo ?? null,
      parroquiaCodigo: input.parroquiaCodigo ?? null,
      tipoPreasignado: input.tipoPreasignado ?? null,
      creadoEn: new Date().toISOString(),
    });
  }

  if (validas.length === 0) return { creados: 0, omitidos };

  if (supabaseSecret) {
    const { error } = await supabaseSecret.from("militantes").insert(
      validas.map((v) => ({
        cedula: v.cedula,
        nombres: v.nombres,
        telefono: v.telefono,
        responsable_lider_id: v.responsableLiderId,
        recinto_codigo: v.recintoCodigo,
        parroquia_codigo: v.parroquiaCodigo,
        tipo_preasignado: v.tipoPreasignado,
      })),
    );
    if (error) throw new Error(error.message);
    return { creados: validas.length, omitidos };
  }

  await mutateCollection<MilitanteSinDuplicado>(COLLECTION, (items) => [
    ...items,
    ...validas,
  ]);
  return { creados: validas.length, omitidos };
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

export async function asignarMilitante(
  id: string,
  destino: AsignarDestino,
): Promise<Veedor | Coordinador | AcreditadoCda> {
  const militante = await obtenerMilitante(id);
  if (!militante) throw new Error("No se encontró el militante.");

  const base = {
    cedula: militante.cedula,
    nombres: militante.nombres,
    telefono: militante.telefono,
    responsableLiderId: militante.responsableLiderId,
    recintoCodigo: destino.recintoCodigo,
    parroquiaCodigo: destino.parroquiaCodigo,
  };

  let creado: Veedor | Coordinador | AcreditadoCda;
  if (destino.tipo === "veedor") {
    const junta = juntaId(destino.recintoCodigo, destino.genero, destino.numero);
    const { titular } = await veedoresPorJunta(junta);
    creado = await agregarVeedor({
      ...base,
      juntaId: junta,
      tipo: titular ? "suplente" : "titular",
    });
  } else if (destino.tipo === "coordinador") {
    const { titular } = await coordinadoresPorRecinto(destino.recintoCodigo);
    creado = await agregarCoordinador({
      ...base,
      tipo: titular ? "suplente" : "titular",
    });
  } else {
    const { titular } = await acreditadosCdaPorRecinto(destino.recintoCodigo);
    creado = await agregarAcreditadoCda({
      ...base,
      tipo: titular ? "suplente" : "titular",
    });
  }

  await eliminarMilitante(id);
  return creado;
}
