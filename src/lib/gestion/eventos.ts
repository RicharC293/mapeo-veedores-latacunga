import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import type { EventoActividad, TipoEvento } from "./types";

const COLLECTION = "eventos";

function rowToEvento(row: Record<string, unknown>): EventoActividad {
  return {
    id: row.id as string,
    tipo: row.tipo as TipoEvento,
    cedula: row.cedula as string,
    recintoCodigo: row.recinto_codigo as number,
    parroquiaCodigo: row.parroquia_codigo as number,
    fecha: row.fecha as string,
    creadoEn: row.creado_en as string,
  };
}

// Solo se usa en el respaldo local: contra Supabase, agregar_veedor,
// desvincular_veedor, agregar_coordinador y desvincular_coordinador ya
// insertan en eventos_actividad dentro de la misma función SQL.
export async function registrarEvento(input: {
  tipo: TipoEvento;
  cedula: string;
  recintoCodigo: number;
  parroquiaCodigo: number;
}): Promise<EventoActividad> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("eventos_actividad")
      .insert({
        tipo: input.tipo,
        cedula: input.cedula,
        recinto_codigo: input.recintoCodigo,
        parroquia_codigo: input.parroquiaCodigo,
        fecha: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToEvento(data);
  }

  const now = new Date();
  const evento: EventoActividad = {
    id: randomUUID(),
    tipo: input.tipo,
    cedula: input.cedula,
    recintoCodigo: input.recintoCodigo,
    parroquiaCodigo: input.parroquiaCodigo,
    fecha: now.toISOString().slice(0, 10),
    creadoEn: now.toISOString(),
  };
  await mutateCollection<EventoActividad>(COLLECTION, (items) => [
    ...items,
    evento,
  ]);
  return evento;
}

export async function listEventos(): Promise<EventoActividad[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("eventos_actividad")
      .select("*");
    if (error) throw new Error(error.message);
    return data.map(rowToEvento);
  }
  return readCollection<EventoActividad>(COLLECTION);
}
