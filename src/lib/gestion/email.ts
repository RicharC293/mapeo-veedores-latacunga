// Correo electrónico opcional de una persona: '' significa "sin correo".
// Se guarda en minúsculas y sin espacios; solo se valida el formato básico.
const FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(valor: string | null | undefined): string {
  return (valor ?? "").trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return FORMATO.test(email);
}

// Normaliza y valida un correo ingresado por una persona; vacío es válido.
export function resolverEmail(valor: string | null | undefined): string {
  const email = normalizarEmail(valor);
  if (email && !emailValido(email)) {
    throw new Error("Correo inválido: revisa el formato (nombre@dominio.com).");
  }
  return email;
}
