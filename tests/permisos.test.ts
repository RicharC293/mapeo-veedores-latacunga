import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGINAS_GESTION, tienePermiso } from "../src/lib/auth/roles";

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f);
    return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
  });
}

describe("permisos por rol", () => {
  it("el gestor y el administrador usan toda la pestaña Militancia", () => {
    expect(tienePermiso("gestor", PAGINAS_GESTION.militancia)).toBe(true);
    expect(tienePermiso("administrador", PAGINAS_GESTION.militancia)).toBe(
      true,
    );
  });

  it("el militante y el invitado no entran a Militancia", () => {
    expect(tienePermiso("militante", PAGINAS_GESTION.militancia)).toBe(false);
    expect(tienePermiso("invitado", PAGINAS_GESTION.militancia)).toBe(false);
  });

  it("Accesos y Líderes siguen siendo solo del administrador", () => {
    expect(tienePermiso("gestor", PAGINAS_GESTION.accesos)).toBe(false);
    expect(tienePermiso("gestor", PAGINAS_GESTION.lideres)).toBe(false);
  });

  // Toda acción de Militancia (cargar, editar, asignar, eliminar, historial,
  // autocompletar) vive bajo /api/gestion/militancia: cada una debe validar
  // el mismo permiso, para que el gestor pueda hacerlas todas y nadie más.
  it("cada ruta API de Militancia valida el permiso de Militancia", () => {
    const rutas = [
      "src/pages/api/gestion/militancia.ts",
      ...archivos("src/pages/api/gestion/militancia"),
    ];
    for (const ruta of rutas) {
      const codigo = readFileSync(ruta, "utf8");
      const handlers = codigo.match(/export const (GET|POST|PATCH|DELETE)\b/g);
      const validaciones = codigo.match(
        /requireApiRole\(locals, PAGINAS_GESTION\.militancia\)/g,
      );
      expect(handlers?.length ?? 0, ruta).toBeGreaterThan(0);
      expect(validaciones?.length ?? 0, ruta).toBe(handlers?.length);
    }
  });

  // Mover a una persona toca las tres tablas de asignados: solo quien ve el
  // Consolidado (gestor y administrador) puede hacerlo.
  it("la ruta API de mover valida el permiso de Consolidado", () => {
    const codigo = readFileSync(
      "src/pages/api/gestion/consolidado/mover.ts",
      "utf8",
    );
    expect(codigo).toContain(
      "requireApiRole(locals, PAGINAS_GESTION.consolidado)",
    );
    expect(tienePermiso("gestor", PAGINAS_GESTION.consolidado)).toBe(true);
    expect(tienePermiso("militante", PAGINAS_GESTION.consolidado)).toBe(false);
  });
});
