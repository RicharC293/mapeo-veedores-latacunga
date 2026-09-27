import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { cedulaValida, normalizarCedula } from "./cedula";
import { rowToListaNegra } from "./rows";
import type { Database } from "../database.types";
import type { ListaNegraEntry, OrigenListaNegra } from "./types";

type ListaNegraUpdate = Database["public"]["Tables"]["lista_negra"]["Update"];

const COLLECTION = "lista_negra";

export async function listListaNegra(): Promise<ListaNegraEntry[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("lista_negra")
      .select("*");
    if (error) throw new Error(error.message);
    return data.map(rowToListaNegra);
  }
  return readCollection<ListaNegraEntry>(COLLECTION);
}

export async function estaEnListaNegra(cedula: string): Promise<boolean> {
  const c = normalizarCedula(cedula);
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("lista_negra")
      .select("id")
      .eq("cedula", c)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data != null;
  }
  const items = await listListaNegra();
  return items.some((i) => i.cedula === c);
}

export async function agregarAListaNegra(input: {
  cedula: string;
  nombres: string;
  telefono: string;
  motivo: string | null;
  origen: OrigenListaNegra;
}): Promise<ListaNegraEntry> {
  const cedula = normalizarCedula(input.cedula);
  if (!cedulaValida(cedula))
    throw new Error("Cédula inválida: debe tener 10 dígitos.");

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("lista_negra")
      .insert({
        cedula,
        nombres: input.nombres.trim(),
        telefono: input.telefono.trim(),
        motivo: input.motivo?.trim() || null,
        origen: input.origen,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error("Esa cédula ya está en la lista negra.");
      throw new Error(error.message);
    }
    return rowToListaNegra(data);
  }

  let creado: ListaNegraEntry | null = null;
  await mutateCollection<ListaNegraEntry>(COLLECTION, (items) => {
    if (items.some((i) => i.cedula === cedula)) {
      throw new Error("Esa cédula ya está en la lista negra.");
    }
    const entry: ListaNegraEntry = {
      id: randomUUID(),
      cedula,
      nombres: input.nombres.trim(),
      telefono: input.telefono.trim(),
      motivo: input.motivo?.trim() || null,
      origen: input.origen,
      creadoEn: new Date().toISOString(),
    };
    creado = entry;
    return [...items, entry];
  });
  return creado!;
}

export async function editarListaNegra(
  id: string,
  patch: Partial<Pick<ListaNegraEntry, "nombres" | "telefono" | "motivo">>,
): Promise<ListaNegraEntry> {
  if (supabaseSecret) {
    const dbPatch: ListaNegraUpdate = {};
    if (patch.nombres !== undefined) dbPatch.nombres = patch.nombres.trim();
    if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono.trim();
    if (patch.motivo !== undefined)
      dbPatch.motivo = patch.motivo?.trim() || null;
    const { data, error } = await supabaseSecret
      .from("lista_negra")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToListaNegra(data);
  }

  let actualizado: ListaNegraEntry | null = null;
  await mutateCollection<ListaNegraEntry>(COLLECTION, (items) =>
    items.map((i) => {
      if (i.id !== id) return i;
      actualizado = {
        ...i,
        ...(patch.nombres !== undefined
          ? { nombres: patch.nombres.trim() }
          : {}),
        ...(patch.telefono !== undefined
          ? { telefono: patch.telefono.trim() }
          : {}),
        ...(patch.motivo !== undefined
          ? { motivo: patch.motivo?.trim() || null }
          : {}),
      };
      return actualizado;
    }),
  );
  if (!actualizado)
    throw new Error("No se encontró el registro en la lista negra.");
  return actualizado;
}

export async function quitarDeListaNegra(id: string): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("lista_negra")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<ListaNegraEntry>(COLLECTION, (items) =>
    items.filter((i) => i.id !== id),
  );
}
