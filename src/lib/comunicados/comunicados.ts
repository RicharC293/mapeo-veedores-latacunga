import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "../gestion/jsonStore";
import type { Json } from "../database.types";
import {
  leerFiltros,
  type Comunicado,
  type EnvioComunicado,
  type FiltrosComunicado,
} from "./plan";

const COMUNICADOS = "comunicados";
const ENVIOS = "comunicado_envios";

export interface DatosNuevoComunicado {
  titulo: string;
  mensaje: string;
  enlace: string;
  filtros: FiltrosComunicado;
}

function validar(d: DatosNuevoComunicado): DatosNuevoComunicado {
  const titulo = d.titulo.trim();
  if (!titulo) throw new Error("Ponle un título al comunicado.");
  return {
    titulo,
    mensaje: d.mensaje,
    enlace: d.enlace.trim(),
    filtros: leerFiltros(d.filtros),
  };
}

export async function listComunicados(): Promise<Comunicado[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("comunicados")
      .select("*")
      .order("creado_en", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      id: r.id,
      titulo: r.titulo,
      mensaje: r.mensaje,
      enlace: r.enlace,
      filtros: leerFiltros(r.filtros),
      creadoPor: r.creado_por,
      creadoEn: r.creado_en,
      actualizadoEn: r.actualizado_en,
    }));
  }
  const items = await readCollection<Comunicado>(COMUNICADOS);
  return [...items].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export async function listEnvios(): Promise<EnvioComunicado[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("comunicado_envios")
      .select("*");
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      comunicadoId: r.comunicado_id,
      numero: r.numero,
      enviadoPor: r.enviado_por,
      enviadoEn: r.enviado_en,
    }));
  }
  return readCollection<EnvioComunicado>(ENVIOS);
}

export async function crearComunicado(
  datos: DatosNuevoComunicado,
  usuario: string,
): Promise<Comunicado> {
  const d = validar(datos);
  const ahora = new Date().toISOString();
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("comunicados")
      .insert({
        titulo: d.titulo,
        mensaje: d.mensaje,
        enlace: d.enlace,
        filtros: d.filtros as unknown as Json,
        creado_por: usuario,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      ...d,
      id: data.id,
      creadoPor: data.creado_por,
      creadoEn: data.creado_en,
      actualizadoEn: data.actualizado_en,
    };
  }
  const nuevo: Comunicado = {
    ...d,
    id: randomUUID(),
    creadoPor: usuario,
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
  await mutateCollection<Comunicado>(COMUNICADOS, (items) => [...items, nuevo]);
  return nuevo;
}

export async function actualizarComunicado(
  id: string,
  datos: DatosNuevoComunicado,
): Promise<Comunicado> {
  const d = validar(datos);
  const ahora = new Date().toISOString();
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("comunicados")
      .update({
        titulo: d.titulo,
        mensaje: d.mensaje,
        enlace: d.enlace,
        filtros: d.filtros as unknown as Json,
        actualizado_en: ahora,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      ...d,
      id: data.id,
      creadoPor: data.creado_por,
      creadoEn: data.creado_en,
      actualizadoEn: data.actualizado_en,
    };
  }
  let actualizado: Comunicado | undefined;
  await mutateCollection<Comunicado>(COMUNICADOS, (items) =>
    items.map((c) => {
      if (c.id !== id) return c;
      actualizado = { ...c, ...d, actualizadoEn: ahora };
      return actualizado;
    }),
  );
  if (!actualizado) throw new Error("Ese comunicado ya no existe.");
  return actualizado;
}

// Borra el comunicado y su registro de envíos.
export async function eliminarComunicado(id: string): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("comunicados")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<Comunicado>(COMUNICADOS, (items) =>
    items.filter((c) => c.id !== id),
  );
  await mutateCollection<EnvioComunicado>(ENVIOS, (items) =>
    items.filter((e) => e.comunicadoId !== id),
  );
}

export async function marcarEnviado(
  comunicadoId: string,
  numero: string,
  usuario: string,
): Promise<EnvioComunicado> {
  if (!/^5939\d{8}$/.test(numero)) throw new Error("Celular inválido.");
  const envio: EnvioComunicado = {
    comunicadoId,
    numero,
    enviadoPor: usuario,
    enviadoEn: new Date().toISOString(),
  };
  if (supabaseSecret) {
    const { error } = await supabaseSecret.from("comunicado_envios").upsert(
      {
        comunicado_id: comunicadoId,
        numero,
        enviado_por: usuario,
        enviado_en: envio.enviadoEn,
      },
      { onConflict: "comunicado_id,numero" },
    );
    if (error) throw new Error(error.message);
    return envio;
  }
  await mutateCollection<EnvioComunicado>(ENVIOS, (items) => [
    ...items.filter(
      (e) => !(e.comunicadoId === comunicadoId && e.numero === numero),
    ),
    envio,
  ]);
  return envio;
}

export async function desmarcarEnviado(
  comunicadoId: string,
  numero: string,
): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("comunicado_envios")
      .delete()
      .eq("comunicado_id", comunicadoId)
      .eq("numero", numero);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<EnvioComunicado>(ENVIOS, (items) =>
    items.filter(
      (e) => !(e.comunicadoId === comunicadoId && e.numero === numero),
    ),
  );
}
