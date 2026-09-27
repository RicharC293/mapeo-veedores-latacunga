import type { APIRoute } from "astro";
import {
  agregarAListaNegra,
  listListaNegra,
} from "../../../lib/gestion/listaNegra";
import { json, handle } from "../../../lib/gestion/apiHelpers";

export const GET: APIRoute = async () =>
  handle(async () => json(await listListaNegra()));

export const POST: APIRoute = async ({ request }) =>
  handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      motivo: string | null;
    };
    const entry = await agregarAListaNegra({ ...body, origen: "manual" });
    return json(entry, { status: 201 });
  });
