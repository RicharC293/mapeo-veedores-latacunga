import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { normalizarEnlaceGrupo, type GrupoRecinto } from "./grupoWhatsapp";

const COLECCION = "recinto_grupos";

export async function listGruposWhatsapp(): Promise<GrupoRecinto[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("recinto_grupos")
      .select("*");
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      recintoCodigo: r.recinto_codigo,
      enlace: r.enlace,
      actualizadoPor: r.actualizado_por,
      actualizadoEn: r.actualizado_en,
    }));
  }
  return readCollection<GrupoRecinto>(COLECCION);
}

// Guarda el enlace del grupo de un recinto; con el texto vacío lo quita.
export async function guardarGrupoWhatsapp(
  recintoCodigo: number,
  texto: string,
  usuario: string,
): Promise<GrupoRecinto | null> {
  if (!Number.isInteger(recintoCodigo)) throw new Error("Recinto inválido.");
  if (texto.trim() === "") {
    if (supabaseSecret) {
      const { error } = await supabaseSecret
        .from("recinto_grupos")
        .delete()
        .eq("recinto_codigo", recintoCodigo);
      if (error) throw new Error(error.message);
    } else {
      await mutateCollection<GrupoRecinto>(COLECCION, (items) =>
        items.filter((g) => g.recintoCodigo !== recintoCodigo),
      );
    }
    return null;
  }
  const enlace = normalizarEnlaceGrupo(texto);
  if (!enlace) {
    throw new Error(
      "Ese no es un enlace de invitación de WhatsApp (https://chat.whatsapp.com/…).",
    );
  }
  const grupo: GrupoRecinto = {
    recintoCodigo,
    enlace,
    actualizadoPor: usuario,
    actualizadoEn: new Date().toISOString(),
  };
  if (supabaseSecret) {
    const { error } = await supabaseSecret.from("recinto_grupos").upsert(
      {
        recinto_codigo: recintoCodigo,
        enlace,
        actualizado_por: usuario,
        actualizado_en: grupo.actualizadoEn,
      },
      { onConflict: "recinto_codigo" },
    );
    if (error) throw new Error(error.message);
    return grupo;
  }
  await mutateCollection<GrupoRecinto>(COLECCION, (items) => [
    ...items.filter((g) => g.recintoCodigo !== recintoCodigo),
    grupo,
  ]);
  return grupo;
}
