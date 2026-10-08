import { elegirJuntaAutomatica } from "./juntaAutomatica";
import { listJuntasDeRecinto } from "./juntas";
import type { Recinto } from "../types";

// Lógica pura (sin servidor) del botón "Mover" de Consolidado: la usan tanto
// el diálogo, para mostrar de antemano qué pasará, como el servidor, que la
// repite antes de tocar nada.

export type Clase = "veedor" | "coordinador" | "cda";

export const ETIQUETA_CLASE: Record<Clase, string> = {
  veedor: "Veedor",
  coordinador: "Coordinador",
  cda: "Acreditado CDA",
};

// Cómo se nombra el puesto dentro de una frase ("quedará como veedor titular").
export const PUESTO_CLASE: Record<Clase, string> = {
  veedor: "veedor",
  coordinador: "coordinador",
  cda: "acreditado CDA",
};

// Lo mínimo de una persona ya asignada para decidir dónde puede ir.
export interface Ocupante {
  id: string;
  cedula: string;
  nombres: string;
  tipo: "titular" | "suplente";
  recintoCodigo: number;
}
export interface OcupanteVeedor extends Ocupante {
  juntaId: string;
}

export interface EstadoPuestos {
  veedores: OcupanteVeedor[];
  coordinadores: Ocupante[];
  acreditados: Ocupante[];
}

export interface Origen {
  id: string;
  cedula: string;
  clase: Clase;
  recintoCodigo: number;
  // Solo si es veedor.
  juntaId: string | null;
}

export interface DestinoSolicitado {
  clase: Clase;
  recintoCodigo: number;
  // null = la primera junta disponible (solo aplica a veedores).
  juntaId: string | null;
}

export type PlanMovimiento =
  | {
      ok: true;
      clase: Clase;
      recintoCodigo: number;
      // Solo veedores: la junta donde quedará.
      juntaId: string | null;
      rol: "titular" | "suplente";
      // Si queda como suplente, el titular del lugar.
      titular: string | null;
    }
  | { ok: false; motivo: string };

const error = (motivo: string): PlanMovimiento => ({ ok: false, motivo });

// Texto corto de una junta ("F12") a partir de su id ("1582-F12").
export function etiquetaJunta(juntaId: string): string {
  return juntaId.slice(juntaId.lastIndexOf("-") + 1);
}

// Decide dónde quedaría la persona y como qué, con las mismas reglas de
// Militancia: cada junta (veedor) y cada recinto (coordinador, CDA) admite un
// titular y un solo suplente. Con juntaId null, el veedor cubre la primera
// junta disponible del recinto: titulares primero y, completos, suplentes.
export function planificarMovimiento(
  origen: Origen,
  destino: DestinoSolicitado,
  estado: EstadoPuestos,
  recintos: Recinto[],
): PlanMovimiento {
  const recinto = recintos.find((r) => r.cod === destino.recintoCodigo);
  if (!recinto) return error("Elige el recinto de destino.");
  if (destino.clase === "cda" && !recinto.cda) {
    return error("Ese recinto no es CDA: elige uno que lo sea.");
  }

  // La misma cédula no puede constar dos veces: la persona que se mueve se
  // quita de su lugar, pero cualquier otro registro suyo bloquearía el alta.
  const otra = estado.veedores.find(
    (v) => v.cedula === origen.cedula && v.id !== origen.id,
  )
    ? "veedor"
    : estado.coordinadores.find(
          (c) => c.cedula === origen.cedula && c.id !== origen.id,
        )
      ? "coordinador"
      : estado.acreditados.find(
            (a) => a.cedula === origen.cedula && a.id !== origen.id,
          )
        ? "cda"
        : null;
  if (otra) {
    return error(
      `Esta persona consta también como ${PUESTO_CLASE[otra]} en otro lugar. Desvincula uno de los dos registros antes de moverla.`,
    );
  }

  const ocupar = (
    ocupantes: Ocupante[],
  ): { rol: "titular" | "suplente"; titular: string | null } | string => {
    const titular = ocupantes.find((o) => o.tipo === "titular");
    if (!titular) return { rol: "titular", titular: null };
    if (ocupantes.some((o) => o.tipo === "suplente")) {
      return "Ese lugar ya tiene titular y suplente: no quedan cupos.";
    }
    return { rol: "suplente", titular: titular.nombres };
  };

  if (destino.clase === "veedor") {
    const juntas = listJuntasDeRecinto(recinto).map((j) => j.id);
    if (juntas.length === 0) return error("Ese recinto no tiene juntas.");
    const otros = estado.veedores.filter((v) => v.id !== origen.id);

    if (destino.juntaId) {
      if (!juntas.includes(destino.juntaId)) {
        return error("Esa junta no pertenece al recinto elegido.");
      }
      if (destino.juntaId === origen.juntaId) {
        return error("La persona ya está en esa junta.");
      }
      const r = ocupar(otros.filter((v) => v.juntaId === destino.juntaId));
      if (typeof r === "string") return error(r);
      return {
        ok: true,
        clase: "veedor",
        recintoCodigo: recinto.cod,
        juntaId: destino.juntaId,
        ...r,
      };
    }

    // Primera disponible: la junta de la que sale no cuenta como destino.
    const candidatas = juntas.filter((id) => id !== origen.juntaId);
    const eleccion = elegirJuntaAutomatica(
      candidatas,
      otros.map((v) => ({
        juntaId: v.juntaId,
        tipo: v.tipo,
        nombres: v.nombres,
      })),
    );
    if (eleccion.estado === "sin_juntas") {
      return error("Ese recinto no tiene otra junta a la que mover.");
    }
    if (eleccion.estado === "lleno") {
      return error("Todas las juntas de ese recinto están completas.");
    }
    return {
      ok: true,
      clase: "veedor",
      recintoCodigo: recinto.cod,
      juntaId: eleccion.juntaId,
      rol: eleccion.estado,
      titular: eleccion.estado === "suplente" ? eleccion.titular : null,
    };
  }

  if (origen.clase === destino.clase && origen.recintoCodigo === recinto.cod) {
    return error("La persona ya está en ese recinto con esa responsabilidad.");
  }
  const lista =
    destino.clase === "coordinador" ? estado.coordinadores : estado.acreditados;
  const r = ocupar(
    lista.filter((o) => o.recintoCodigo === recinto.cod && o.id !== origen.id),
  );
  if (typeof r === "string") return error(r);
  return {
    ok: true,
    clase: destino.clase,
    recintoCodigo: recinto.cod,
    juntaId: null,
    ...r,
  };
}

// Estado de cada junta de un recinto, para el selector de junta del diálogo.
export interface EstadoJunta {
  juntaId: string;
  titular: string | null;
  suplente: string | null;
}

export function estadoDeJuntas(
  recinto: Recinto,
  veedores: OcupanteVeedor[],
): EstadoJunta[] {
  return listJuntasDeRecinto(recinto).map((j) => {
    const deLaJunta = veedores.filter((v) => v.juntaId === j.id);
    return {
      juntaId: j.id,
      titular: deLaJunta.find((v) => v.tipo === "titular")?.nombres ?? null,
      suplente: deLaJunta.find((v) => v.tipo === "suplente")?.nombres ?? null,
    };
  });
}

// Distancia en km entre dos puntos (fórmula del haversine).
export function distanciaKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface RecintoSinCubrir {
  recinto: Recinto;
  // Juntas sin veedor titular y total de juntas del recinto.
  faltan: number;
  total: number;
  mismaParroquia: boolean;
  km: number;
}

// Recintos con juntas aún sin veedor titular, de los más cercanos al de
// referencia: primero los de su misma parroquia y, dentro de cada grupo, los
// más próximos por latitud y longitud. Sin coordenadas, van al final.
export function recintosCercanosSinCubrir(
  referencia: Recinto,
  recintos: Recinto[],
  veedores: OcupanteVeedor[],
  limite = 5,
): RecintoSinCubrir[] {
  const conTitular = new Set(
    veedores.filter((v) => v.tipo === "titular").map((v) => v.juntaId),
  );
  const punto = (r: Recinto) => ({ lat: r.lat, lon: r.lon });
  const valido = (r: Recinto) =>
    Number.isFinite(r.lat) && Number.isFinite(r.lon);

  return recintos
    .filter((r) => r.cod !== referencia.cod)
    .map((recinto) => {
      const juntas = listJuntasDeRecinto(recinto);
      return {
        recinto,
        faltan: juntas.filter((j) => !conTitular.has(j.id)).length,
        total: juntas.length,
        mismaParroquia: recinto.par === referencia.par,
        km:
          valido(recinto) && valido(referencia)
            ? distanciaKm(punto(referencia), punto(recinto))
            : Number.POSITIVE_INFINITY,
      };
    })
    .filter((r) => r.faltan > 0)
    .sort((a, b) =>
      a.mismaParroquia !== b.mismaParroquia
        ? a.mismaParroquia
          ? -1
          : 1
        : a.km - b.km,
    )
    .slice(0, limite);
}
