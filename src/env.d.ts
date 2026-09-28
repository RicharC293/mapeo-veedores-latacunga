/// <reference types="astro/client" />

import type { Rol } from "./lib/auth/roles";

declare global {
  namespace App {
    interface Locals {
      rol: Rol;
    }
  }
}
