import { supabaseSecret } from "../supabase";
import { mutateCollection } from "./jsonStore";
import type { AcreditadoCda, Coordinador, Veedor } from "./types";

// Completa la preferencia de personas que ya estaban asignadas cuando el campo
// no se guardaba (se perdía al salir de Militancia). Solo rellena las que la
// tienen vacía: nunca pisa una preferencia existente. Devuelve cuántas filas
// se actualizaron.
export async function completarPreferenciasAsignados(
  items: { cedula: string; preferencia: string }[],
): Promise<{ actualizados: number }> {
  const validos = items
    .map((i) => ({
      cedula: i.cedula.trim(),
      preferencia: i.preferencia.trim(),
    }))
    .filter((i) => i.cedula && i.preferencia);
  if (validos.length === 0) return { actualizados: 0 };

  if (supabaseSecret) {
    const db = supabaseSecret;
    const tablas = ["veedores", "coordinadores", "acreditados_cda"] as const;
    let actualizados = 0;
    for (const i of validos) {
      const resultados = await Promise.all(
        tablas.map((t) =>
          db
            .from(t)
            .update({ preferencia: i.preferencia })
            .eq("cedula", i.cedula)
            .eq("preferencia", "")
            .select("id"),
        ),
      );
      for (const r of resultados) {
        if (r.error) throw new Error(r.error.message);
        actualizados += r.data?.length ?? 0;
      }
    }
    return { actualizados };
  }

  const mapa = new Map(validos.map((i) => [i.cedula, i.preferencia]));
  let actualizados = 0;
  const rellenar = <T extends Veedor | Coordinador | AcreditadoCda>(
    items: T[],
  ): T[] =>
    items.map((p) => {
      const pref = mapa.get(p.cedula);
      if (pref && !p.preferencia) {
        actualizados += 1;
        return { ...p, preferencia: pref };
      }
      return p;
    });
  await mutateCollection<Veedor>("veedores", rellenar);
  await mutateCollection<Coordinador>("coordinadores", rellenar);
  await mutateCollection<AcreditadoCda>("acreditados_cda", rellenar);
  return { actualizados };
}
