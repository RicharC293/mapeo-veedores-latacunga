import { defineMiddleware } from "astro:middleware";
import { supabaseServerClient } from "./lib/auth/supabaseServer";
import { buscarAccesoPorToken, marcarUltimoUso } from "./lib/gestion/accesos";
import { supabaseConfigurado } from "./lib/supabase";
import { COOKIE_ACCESO } from "./lib/auth/roles";

export const onRequest = defineMiddleware(async (context, next) => {
  // Sin Supabase configurado no hay forma de verificar nada: se mantiene el
  // comportamiento actual del proyecto (acceso total), igual que el resto
  // de la gestión ya hace con su respaldo JSON local.
  if (!supabaseConfigurado) {
    context.locals.rol = "administrador";
    context.locals.usuario = "Administrador (modo local)";
    return next();
  }

  // supabaseConfigurado ya garantiza url+publishableKey, así que el cliente
  // nunca es null en esta rama.
  const supabase = supabaseServerClient(context.request, context.cookies)!;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    context.locals.rol = "administrador";
    context.locals.usuario = user.email ?? "Administrador";
    return next();
  }

  const token = context.cookies.get(COOKIE_ACCESO)?.value;
  if (token) {
    const acceso = await buscarAccesoPorToken(token);
    if (acceso && acceso.activo) {
      context.locals.rol = acceso.rol;
      context.locals.usuario = acceso.etiqueta || `Enlace ${acceso.rol}`;
      void marcarUltimoUso(acceso.id);
      return next();
    }
  }

  context.locals.rol = "invitado";
  context.locals.usuario = "";
  return next();
});
