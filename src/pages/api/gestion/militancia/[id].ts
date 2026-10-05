import type { APIRoute } from "astro";
import {
  editarMilitante,
  eliminarMilitante,
  type MilitantePatch,
} from "../../../../lib/gestion/militancia";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del militante.");
    const body = (await request.json()) as MilitantePatch;
    const militante = await editarMilitante(
      id,
      {
        cedula: body.cedula,
        nombres: body.nombres,
        telefono: body.telefono,
        email: body.email,
        preferencia: body.preferencia,
        responsableLiderId: body.responsableLiderId,
      },
      locals.usuario,
    );
    return json(militante);
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del militante.");
    await eliminarMilitante(id);
    return json({ ok: true });
  });
};
