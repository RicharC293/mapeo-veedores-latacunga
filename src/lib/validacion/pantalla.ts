import type { ValidacionCedula } from "./plan";

// Validaciones listas para enviar al Consolidado. La respuesta completa del
// Registro Civil (fecha y lugar de nacimiento, etc.) solo va a quien puede
// verificar identidades; el resto ve el estado, la edad y el género.
export function validacionesParaVista(
  validaciones: ValidacionCedula[],
  conRespuesta: boolean,
): ValidacionCedula[] {
  return validaciones.map((v) =>
    conRespuesta ? v : { ...v, respuesta: null },
  );
}
