import { COSTO_POR_CONSULTA } from "./ecuadorApi";
import { resumenValidacion } from "./validaciones";
import type { FilaRevision, PersonaRegistrada } from "./plan";

// Lo que necesita la pantalla de Validación de cédulas, ya listo para enviar
// al navegador (solo a administradores).
export interface DatosValidacion {
  costoPorConsulta: number;
  personas: number;
  validadas: number;
  noEncontradas: number;
  conError: number;
  pendientes: number;
  invalidas: PersonaRegistrada[];
  revision: (FilaRevision & { respuesta: unknown })[];
  noEncontradasDetalle: {
    persona: PersonaRegistrada;
    error: string | null;
    respuesta: unknown;
  }[];
}

export async function datosPantallaValidacion(): Promise<DatosValidacion> {
  const { resumen, validaciones } = await resumenValidacion();
  const respuestaDe = new Map(validaciones.map((v) => [v.cedula, v.respuesta]));
  return {
    costoPorConsulta: COSTO_POR_CONSULTA,
    personas: resumen.personas,
    validadas: resumen.validadas,
    noEncontradas: resumen.noEncontradas,
    conError: resumen.conError,
    pendientes: resumen.pendientes.length,
    invalidas: resumen.invalidas,
    revision: resumen.revision.map((f) => ({
      ...f,
      respuesta: respuestaDe.get(f.cedula) ?? null,
    })),
    noEncontradasDetalle: resumen.noEncontradasDetalle.map((d) => ({
      persona: d.persona,
      error: d.validacion.error,
      respuesta: d.validacion.respuesta,
    })),
  };
}
