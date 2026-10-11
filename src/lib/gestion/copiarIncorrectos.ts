import { normalizarEmail } from "./email";
import {
  cedulaEcuatorianaValida,
  erroresMilitante,
} from "./validacionMilitante";
import type { Militante } from "./types";

export const SEPARADOR_INCORRECTOS = "___________________";

// Por qué una fila está marcada "Incorrecto", con el detalle que ayuda a
// corregirla (cuántos dígitos trae, qué falta) en lugar del mensaje genérico.
export function razonesIncorrecto(
  m: Pick<Militante, "cedula" | "nombres" | "telefono" | "email">,
): string[] {
  const errores = erroresMilitante(m);
  const razones: string[] = [];
  const cedula = m.cedula.trim();
  const telefono = m.telefono.trim();
  if (errores.cedula) {
    if (cedula === "") razones.push("Falta la cédula.");
    else if (!/^\d+$/.test(cedula))
      razones.push("La cédula tiene caracteres que no son dígitos.");
    else if (cedula.length !== 10)
      razones.push(`La cédula tiene ${cedula.length} dígitos (debe tener 10).`);
    else if (!cedulaEcuatorianaValida(cedula))
      razones.push("La cédula no pasa el dígito verificador.");
  }
  if (errores.nombres) razones.push("Falta el nombre.");
  if (errores.telefono) {
    if (telefono === "") razones.push("Falta el teléfono.");
    else if (!/^\d+$/.test(telefono))
      razones.push("El teléfono tiene caracteres que no son dígitos.");
    else
      razones.push(
        `El teléfono tiene ${telefono.length} dígitos (debe tener 10).`,
      );
  }
  if (errores.email)
    razones.push(
      `El correo "${normalizarEmail(m.email)}" no tiene un formato válido.`,
    );
  return razones;
}

// Texto listo para pegar con todos los registros incorrectos, uno tras otro,
// separados por una línea de guiones bajos.
export function textoIncorrectos(
  militantes: Militante[],
  nombreResponsable: (id: string | null) => string,
): string {
  return militantes
    .filter((m) => m.incorrecto)
    .map((m) =>
      [
        `Nombres: ${m.nombres.trim()}`,
        `Cédula: ${m.cedula.trim()}`,
        `Teléfono: ${m.telefono.trim()}`,
        `Correo: ${m.email.trim()}`,
        `Responsable: ${nombreResponsable(m.responsableLiderId)}`,
        `Razón de incorrecto: ${razonesIncorrecto(m).join(" ")}`,
      ].join("\n"),
    )
    .join(`\n${SEPARADOR_INCORRECTOS}\n`);
}
