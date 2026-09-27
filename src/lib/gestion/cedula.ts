export function cedulaValida(cedula: string): boolean {
  return /^\d{10}$/.test(cedula);
}

export function normalizarCedula(cedula: string): string {
  return cedula.trim();
}
