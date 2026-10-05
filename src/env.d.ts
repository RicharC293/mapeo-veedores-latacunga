/// <reference types="astro/client" />

import type { Rol } from "./lib/auth/roles";

declare global {
  namespace App {
    interface Locals {
      rol: Rol;
      // Quién hace la petición (correo del administrador o etiqueta del enlace
      // de acceso); se usa para registrar el autor de los cambios.
      usuario: string;
    }
  }
}
