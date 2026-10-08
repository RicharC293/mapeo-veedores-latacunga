export type Rol = "invitado" | "militante" | "gestor" | "administrador";

export const COOKIE_ACCESO = "veeduria_acceso";

// A qué páginas de /gestion (y sus rutas API) tiene acceso cada rol. La
// clave coincide con el "activo" de GestionLayout y con el segmento de la
// URL (index = /gestion).
export const PAGINAS_GESTION: Record<string, Rol[]> = {
  index: ["gestor", "administrador"],
  consolidado: ["gestor", "administrador"],
  veedores: ["gestor", "administrador"],
  coordinadores: ["gestor", "administrador"],
  "acreditados-cda": ["gestor", "administrador"],
  militancia: ["gestor", "administrador"],
  lideres: ["administrador"],
  // Ver y eliminar; el alta/edición manual se filtra aparte (solo admin).
  "lista-negra": ["gestor", "administrador"],
  cobertura: ["militante", "gestor", "administrador"],
  informe: ["militante", "gestor", "administrador"],
  // Traen cédulas y celulares: solo quien gestiona.
  descargas: ["gestor", "administrador"],
  crecimiento: ["militante", "gestor", "administrador"],
  organigrama: ["militante", "gestor", "administrador"],
  estructura: ["militante", "gestor", "administrador"],
  accesos: ["administrador"],
};

export function tienePermiso(rol: Rol, permitido: Rol[]): boolean {
  return permitido.includes(rol);
}

// A dónde mandar a alguien que intentó entrar a una página sin permiso.
export function rutaPorDefecto(rol: Rol): string {
  return rol === "gestor" || rol === "administrador" ? "/gestion" : "/";
}
