import type { Rol } from "../auth/roles";

export function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

// Devuelve una respuesta 403 si el rol de la request no está en la lista de
// permitidos, o null si puede continuar. Uso: `const bloqueo =
// requireApiRole(locals, ["gestor", "administrador"]); if (bloqueo) return
// bloqueo;` al inicio de cada handler.
export function requireApiRole(
  locals: App.Locals,
  permitido: Rol[],
): Response | null {
  if (permitido.includes(locals.rol)) return null;
  return json({ error: "No autorizado." }, { status: 403 });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return json({ error: message }, { status: 400 });
  }
}
