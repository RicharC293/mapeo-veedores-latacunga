// Colores compartidos por los gráficos de gestión. Verde/rojo son los
// mismos valores ya usados en .progress-fill-ok/.progress-fill-pending y
// .chip-estado-ok/-pendiente (tokens.css) — no son distintos por tema.
export const COLOR_VERIFICADO = "#2f9e57";
export const COLOR_PENDIENTE = "#c94b4b";
export const COLOR_NEUTRO = "#8a97a4";

// Paleta rotativa para series dinámicas (una por líder, etc.) sin depender
// de una lista fija de colores en CSS.
export function colorRotativo(indice: number, total: number): string {
  const hue = total > 0 ? Math.round((360 / total) * indice) : 0;
  return `hsl(${hue} 55% 50%)`;
}
