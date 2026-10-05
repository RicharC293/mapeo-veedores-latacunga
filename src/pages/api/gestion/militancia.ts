import type { APIRoute } from "astro";
import {
  agregarMilitante,
  listMilitantes,
} from "../../../lib/gestion/militancia";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listMilitantes()));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      email?: string;
      responsableLiderId: string | null;
    };
    const militante = await agregarMilitante(body);
    return json(militante, { status: 201 });
  });
};
