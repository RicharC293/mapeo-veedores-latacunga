import type { APIRoute } from "astro";
import { actualizarFotoLider } from "../../../../../lib/gestion/lideres";
import { supabaseSecret } from "../../../../../lib/supabase";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";

const BUCKET = "lideres-fotos";

export const POST: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.lideres);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del líder.");
    if (!supabaseSecret) {
      throw new Error(
        "Subir fotos requiere Supabase configurado; no está disponible en modo local.",
      );
    }
    const form = await request.formData();
    const file = form.get("foto");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Falta el archivo de la foto.");
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseSecret.storage
      .from(BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabaseSecret.storage.from(BUCKET).getPublicUrl(path);
    const lider = await actualizarFotoLider(id, data.publicUrl);
    return json(lider);
  });
};
