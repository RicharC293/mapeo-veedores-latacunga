import type { APIRoute } from "astro";
import { agregarLider, listLideres } from "../../../lib/gestion/lideres";
import { json, handle } from "../../../lib/gestion/apiHelpers";

export const GET: APIRoute = async () =>
  handle(async () => json(await listLideres()));

export const POST: APIRoute = async ({ request }) =>
  handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      organizacion: string;
      ambito: "general" | "parroquia";
      parroquiaCodigo: number | null;
      recintoCodigos: number[];
    };
    const lider = await agregarLider(body);
    return json(lider, { status: 201 });
  });
