import type { APIRoute } from "astro";
import {
  editarListaNegra,
  quitarDeListaNegra,
} from "../../../../lib/gestion/listaNegra";
import { json, handle } from "../../../../lib/gestion/apiHelpers";

export const PATCH: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del registro.");
    const patch = await request.json();
    const entry = await editarListaNegra(id, patch);
    return json(entry);
  });

export const DELETE: APIRoute = async ({ params }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del registro.");
    await quitarDeListaNegra(id);
    return json({ ok: true });
  });
