import { getMapData } from "../data";
import {
  agregarVeedor,
  desvincularVeedor,
  listVeedores,
  marcarVerificadoVeedor,
} from "./veedores";
import {
  agregarCoordinador,
  desvincularCoordinador,
  listCoordinadores,
  marcarVerificadoCoordinador,
} from "./coordinadores";
import {
  agregarAcreditadoCda,
  desvincularAcreditadoCda,
  listAcreditadosCda,
  marcarVerificadoAcreditadoCda,
} from "./acreditadosCda";
import { eliminarMilitante, idsMilitantesPorCedula } from "./militancia";
import {
  planificarMovimiento,
  type Clase,
  type DestinoSolicitado,
} from "./movimiento";
import type { AcreditadoCda, Coordinador, Veedor } from "./types";

export interface ResultadoMovimiento {
  nombres: string;
  clase: Clase;
  rol: "titular" | "suplente";
  recintoCodigo: number;
  juntaId: string | null;
  // Solo si, tras mover, no se pudo limpiar la fila de paso en Militancia.
  aviso?: string;
}

// Mueve a una persona ya asignada a otro lugar (junta, recinto o
// responsabilidad). Todo se decide y valida antes de tocar nada; después se
// la desvincula SIN lista negra (en Supabase eso la deja un instante en
// Militancia, con sus datos) y se la da de alta en el destino con las
// mismas funciones de siempre, así las reglas son las de Veedores,
// Coordinadores y CDA. Si el alta fallara, la persona queda en Militancia con
// su lugar de origen precargado: nunca se pierde.
export async function moverPersona(input: {
  clase: Clase;
  id: string;
  destino: DestinoSolicitado;
}): Promise<ResultadoMovimiento> {
  const [data, veedores, coordinadores, acreditados] = await Promise.all([
    getMapData(),
    listVeedores(),
    listCoordinadores(),
    listAcreditadosCda(),
  ]);

  const persona: Veedor | Coordinador | AcreditadoCda | undefined =
    input.clase === "veedor"
      ? veedores.find((v) => v.id === input.id)
      : input.clase === "coordinador"
        ? coordinadores.find((c) => c.id === input.id)
        : acreditados.find((a) => a.id === input.id);
  if (!persona) throw new Error("No se encontró a la persona.");

  const plan = planificarMovimiento(
    {
      id: persona.id,
      cedula: persona.cedula,
      clase: input.clase,
      recintoCodigo: persona.recintoCodigo,
      juntaId: input.clase === "veedor" ? (persona as Veedor).juntaId : null,
    },
    input.destino,
    { veedores, coordinadores, acreditados },
    data.recintos,
  );
  if (!plan.ok) throw new Error(plan.motivo);

  const recinto = data.recintos.find((r) => r.cod === plan.recintoCodigo);
  if (!recinto) throw new Error("Recinto no encontrado.");

  const enMilitanciaAntes = await idsMilitantesPorCedula(persona.cedula);

  // 1. Sale de su lugar (sin lista negra). Un suplente sube a titular si
  // hacía falta, como en cualquier desvinculación.
  if (input.clase === "veedor")
    await desvincularVeedor(persona.id, null, false);
  else if (input.clase === "coordinador")
    await desvincularCoordinador(persona.id, null, false);
  else await desvincularAcreditadoCda(persona.id, null, false);

  // 2. Alta en el destino.
  const base = {
    cedula: persona.cedula,
    nombres: persona.nombres,
    telefono: persona.telefono,
    email: persona.email,
    preferencia: persona.preferencia,
    responsableLiderId: persona.responsableLiderId,
    recintoCodigo: recinto.cod,
    parroquiaCodigo: recinto.par,
    tipo: plan.rol,
  };
  let nuevo: Veedor | Coordinador | AcreditadoCda;
  try {
    if (plan.clase === "veedor") {
      nuevo = await agregarVeedor({ ...base, juntaId: plan.juntaId! });
    } else if (plan.clase === "coordinador") {
      nuevo = await agregarCoordinador(base);
    } else {
      nuevo = await agregarAcreditadoCda(base);
    }
  } catch (err) {
    const motivo = err instanceof Error ? err.message : "Error inesperado.";
    throw new Error(
      `No se pudo completar el movimiento (${motivo}). ${persona.nombres} quedó en Militancia con su lugar anterior precargado, desde donde puedes volver a asignar a esa persona.`,
      { cause: err },
    );
  }

  // 3. Limpieza: la fila de paso en Militancia ya no hace falta, y la marca
  // de "verificado" viaja con la persona.
  let aviso: string | undefined;
  try {
    const despues = await idsMilitantesPorCedula(persona.cedula);
    for (const id of despues) {
      if (!enMilitanciaAntes.includes(id)) await eliminarMilitante(id);
    }
  } catch {
    aviso =
      "La persona se movió, pero quedó una fila suya en Militancia: elimínala desde allí.";
  }
  if (persona.verificado) {
    try {
      if (plan.clase === "veedor") await marcarVerificadoVeedor(nuevo.id, true);
      else if (plan.clase === "coordinador")
        await marcarVerificadoCoordinador(nuevo.id, true);
      else await marcarVerificadoAcreditadoCda(nuevo.id, true);
    } catch {
      aviso =
        (aviso ? `${aviso} ` : "") +
        "No se pudo conservar la marca de verificado: vuelve a marcarla.";
    }
  }

  return {
    nombres: persona.nombres,
    clase: plan.clase,
    rol: plan.rol,
    recintoCodigo: plan.recintoCodigo,
    juntaId: plan.juntaId,
    ...(aviso ? { aviso } : {}),
  };
}
