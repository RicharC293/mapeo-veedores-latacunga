import type { APIRoute } from "astro";
import { agregarLider, listLideres } from "../../../lib/gestion/lideres";
import {
  json,
  handle,
  requireApiRole,
} from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.lideres);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listLideres()));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.lideres);
  if (bloqueo) return bloqueo;
  return handle(async () => {
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
};
