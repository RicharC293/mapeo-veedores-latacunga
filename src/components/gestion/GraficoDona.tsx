import { useCallback, useMemo } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas, { type TemaColores } from "./ChartCanvas";
import {
  COLOR_PENDIENTE,
  COLOR_SIN_VERIFICAR,
  COLOR_VERIFICADO,
} from "../../lib/gestion/chartColors";
import type { Modo, Segmento } from "../../lib/gestion/tablero";

interface Props {
  segmentos: Segmento[];
  modo: Modo;
  titulo: string;
}

function colorPrincipal(
  modo: Modo,
  ctx: { chart: { canvas: HTMLCanvasElement } },
): string {
  if (modo === "verificados") return COLOR_VERIFICADO;
  if (modo === "sinverificar") return COLOR_SIN_VERIFICAR;
  return (
    getComputedStyle(ctx.chart.canvas).getPropertyValue("--series-1").trim() ||
    "#2a78d6"
  );
}

// Dona con lo que cuenta según el modo y el resto hasta lo requerido.
export default function GraficoDona({ segmentos, modo, titulo }: Props) {
  const total = segmentos.reduce((a, s) => a + s.valor, 0);

  const data: ChartData<"doughnut"> = useMemo(
    () => ({
      labels: segmentos.map((s) => s.etiqueta),
      datasets: [
        {
          data: segmentos.map((s) => s.valor),
          backgroundColor: (ctx: {
            dataIndex: number;
            chart: { canvas: HTMLCanvasElement };
          }) =>
            segmentos[ctx.dataIndex]?.tono === "principal"
              ? colorPrincipal(modo, ctx)
              : COLOR_PENDIENTE,
          borderWidth: 0,
        },
      ],
    }),
    [segmentos, modo],
  );

  const buildOptions = useCallback(
    (colores: TemaColores): ChartOptions<"doughnut"> => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: colores.ink } },
        tooltip: {
          backgroundColor: colores.panel,
          titleColor: colores.ink,
          bodyColor: colores.ink,
          borderColor: colores.line,
          borderWidth: 1,
        },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 11 },
          formatter: (valor: number, ctx) => {
            const suma = (ctx.dataset.data as number[]).reduce(
              (a, b) => a + b,
              0,
            );
            if (suma === 0 || valor === 0) return "";
            return `${Math.round((valor / suma) * 100)}%`;
          },
        },
      },
    }),
    [],
  );

  if (total === 0) {
    return (
      <p class="g-empty">No hay datos para {titulo.toLowerCase()} todavía.</p>
    );
  }

  return (
    <ChartCanvas
      type="doughnut"
      data={data}
      buildOptions={buildOptions}
      height={280}
      ariaLabel={`Gráfico de dona: ${titulo}. ${segmentos
        .map((s) => `${s.valor} ${s.etiqueta.toLowerCase()}`)
        .join(" y ")} de ${total}.`}
    />
  );
}
