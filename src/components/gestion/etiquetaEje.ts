import type { CartesianScaleOptions, Scale } from "chart.js";
import { toFont } from "chart.js/helpers";
import {
  MARGEN_ETIQUETA,
  anchoEtiquetas,
  truncarAlAncho,
} from "../../lib/gestion/chartLayout";

// Etiqueta del eje vertical acortada para que su texto, medido con la
// tipografía real del eje, quepa en el ancho reservado (ver afterFit).
export function etiquetaAjustada(escala: Scale, texto: string): string {
  const ctx = escala.ctx;
  const fuente = toFont(
    (escala.options as CartesianScaleOptions).ticks.font as Parameters<
      typeof toFont
    >[0],
  );
  const ancho = anchoEtiquetas(escala.chart.width) - MARGEN_ETIQUETA;
  ctx.save();
  ctx.font = fuente.string;
  const resultado = truncarAlAncho(
    (t) => ctx.measureText(t).width,
    texto,
    ancho,
  );
  ctx.restore();
  return resultado;
}
