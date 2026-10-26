import type { APIRoute } from "astro";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";
import {
  listContactos,
  registrarContacto,
  type AccionContacto,
} from "../../../lib/contacto/contactos";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.contacto);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listContactos()));
};

const ACCIONES = new Set([
  "enviado",
  "confirmado",
  "numero_equivocado",
  "pendiente",
  "cedula",
]);

// Registra un paso del contacto por WhatsApp de una persona del Consolidado.
export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.contacto);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      cedula?: string;
      accion?: string;
      puesto?: string;
      recibida?: boolean;
    };
    const cedula = body.cedula?.trim() ?? "";
    if (!/^\d{10}$/.test(cedula)) throw new Error("Cédula inválida.");
    if (!body.accion || !ACCIONES.has(body.accion)) {
      throw new Error("Acción desconocida.");
    }
    if (
      (body.accion === "enviado" || body.accion === "confirmado") &&
      !body.puesto
    ) {
      throw new Error("Falta el puesto de la persona.");
    }
    const accion = {
      accion: body.accion,
      puesto: body.puesto,
      recibida: Boolean(body.recibida),
    } as AccionContacto;
    return json(await registrarContacto(cedula, accion, locals.usuario));
  });
};
