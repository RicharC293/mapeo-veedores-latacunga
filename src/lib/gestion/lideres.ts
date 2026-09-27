import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { cedulaValida, normalizarCedula } from "./cedula";
import { rowToLider } from "./rows";
import type { Database } from "../database.types";
import type { Lider } from "./types";

type LiderUpdate = Database["public"]["Tables"]["lideres"]["Update"];

const COLLECTION = "lideres";

export async function listLideres(): Promise<Lider[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret.from("lideres").select("*");
    if (error) throw new Error(error.message);
    return data.map(rowToLider);
  }
  return readCollection<Lider>(COLLECTION);
}

export async function agregarLider(input: {
  cedula: string;
  nombres: string;
  telefono: string;
  organizacion: string;
  ambito: "general" | "parroquia";
  parroquiaCodigo: number | null;
  recintoCodigos: number[];
}): Promise<Lider> {
  const cedula = normalizarCedula(input.cedula);
  if (!cedulaValida(cedula))
    throw new Error("Cédula inválida: debe tener 10 dígitos.");
  if (!input.nombres.trim()) throw new Error("El nombre es obligatorio.");
  if (input.ambito === "parroquia" && input.parroquiaCodigo == null) {
    throw new Error("Debe indicar la parroquia del líder.");
  }

  const parroquiaCodigo =
    input.ambito === "general" ? null : input.parroquiaCodigo;
  const recintoCodigos = input.ambito === "general" ? [] : input.recintoCodigos;

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("lideres")
      .insert({
        cedula,
        nombres: input.nombres.trim(),
        telefono: input.telefono.trim(),
        organizacion: input.organizacion.trim(),
        ambito: input.ambito,
        parroquia_codigo: parroquiaCodigo,
        recinto_codigos: recintoCodigos,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error("Esta cédula ya está registrada como líder.");
      throw new Error(error.message);
    }
    return rowToLider(data);
  }

  let creado: Lider | null = null;
  await mutateCollection<Lider>(COLLECTION, (items) => {
    if (items.some((l) => l.cedula === cedula)) {
      throw new Error("Esta cédula ya está registrada como líder.");
    }
    const lider: Lider = {
      id: randomUUID(),
      cedula,
      nombres: input.nombres.trim(),
      telefono: input.telefono.trim(),
      organizacion: input.organizacion.trim(),
      ambito: input.ambito,
      parroquiaCodigo,
      recintoCodigos,
      creadoEn: new Date().toISOString(),
    };
    creado = lider;
    return [...items, lider];
  });
  return creado!;
}

export async function editarLider(
  id: string,
  patch: Partial<
    Pick<
      Lider,
      | "nombres"
      | "telefono"
      | "organizacion"
      | "parroquiaCodigo"
      | "recintoCodigos"
      | "ambito"
    >
  >,
): Promise<Lider> {
  if (supabaseSecret) {
    const dbPatch: LiderUpdate = {};
    if (patch.nombres !== undefined) dbPatch.nombres = patch.nombres;
    if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
    if (patch.organizacion !== undefined)
      dbPatch.organizacion = patch.organizacion;
    if (patch.ambito !== undefined) dbPatch.ambito = patch.ambito;
    if (patch.parroquiaCodigo !== undefined)
      dbPatch.parroquia_codigo = patch.parroquiaCodigo;
    if (patch.recintoCodigos !== undefined)
      dbPatch.recinto_codigos = patch.recintoCodigos;
    if (patch.ambito === "general") {
      dbPatch.parroquia_codigo = null;
      dbPatch.recinto_codigos = [];
    }
    const { data, error } = await supabaseSecret
      .from("lideres")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToLider(data);
  }

  let actualizado: Lider | null = null;
  await mutateCollection<Lider>(COLLECTION, (items) =>
    items.map((l) => {
      if (l.id !== id) return l;
      actualizado = { ...l, ...patch };
      if (actualizado.ambito === "general") {
        actualizado.parroquiaCodigo = null;
        actualizado.recintoCodigos = [];
      }
      return actualizado;
    }),
  );
  if (!actualizado) throw new Error("No se encontró el líder.");
  return actualizado;
}

export async function eliminarLider(id: string): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("lideres")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<Lider>(COLLECTION, (items) =>
    items.filter((l) => l.id !== id),
  );
}
