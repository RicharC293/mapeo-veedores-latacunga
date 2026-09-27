import type { APIRoute } from "astro";
import { editarLider, eliminarLider } from "../../../../lib/gestion/lideres";
import { json, handle } from "../../../../lib/gestion/apiHelpers";

export const PATCH: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del líder.");
    const patch = await request.json();
    const lider = await editarLider(id, patch);
    return json(lider);
  });

export const DELETE: APIRoute = async ({ params }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del líder.");
    await eliminarLider(id);
    return json({ ok: true });
  });
