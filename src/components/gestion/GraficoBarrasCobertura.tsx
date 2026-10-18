import { useCallback, useMemo } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas, { type TemaColores } from "./ChartCanvas";
import { etiquetaAjustada } from "./etiquetaEje";
import {
  ESPACIO_ROTULO_DERECHO,
  abreviarRecinto,
  anchoEtiquetas,
} from "../../lib/gestion/chartLayout";
import {
  COLOR_SIN_VERIFICAR,
  COLOR_VERIFICADO,
} from "../../lib/gestion/chartColors";
import type { Barra, Modo } from "../../lib/gestion/tablero";

interface Props {
  barras: Barra[];
  modo: Modo;
  // Nombre de la serie en la leyenda y en la sugerencia.
  serie: string;
}

function colorSerie1(ctx: { chart: { canvas: HTMLCanvasElement } }): string {
  return (
    getComputedStyle(ctx.chart.canvas).getPropertyValue("--series-1").trim() ||
    "#2a78d6"
  );
}

// Barras horizontales de porcentaje: una por parroquia, recinto o rol según
// lo que el panel desglose. El color cambia con el modo para que se note qué
// se está midiendo (azul ingresados, verde verificados, ámbar sin verificar).
export default function GraficoBarrasCobertura({ barras, modo, serie }: Props) {
  const labels = useMemo(() => barras.map((b) => b.etiqueta), [barras]);

  const data: ChartData<"bar"> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: serie,
          data: barras.map((b) => b.pct),
          backgroundColor:
            modo === "verificados"
              ? COLOR_VERIFICADO
              : modo === "sinverificar"
                ? COLOR_SIN_VERIFICAR
                : colorSerie1,
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    }),
    [labels, barras, modo, serie],
  );

  const buildOptions = useCallback(
    (colores: TemaColores): ChartOptions<"bar"> => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: ESPACIO_ROTULO_DERECHO } },
      scales: {
        x: {
          min: 0,
          max: 100,
          ticks: { color: colores.muted, callback: (v) => `${v}%` },
          grid: { color: colores.chartGrid },
        },
        y: {
          afterFit: (scale) => {
            scale.width = anchoEtiquetas(scale.chart.width);
          },
          ticks: {
            color: colores.muted,
            autoSkip: false,
            callback: function (value) {
              return etiquetaAjustada(
                this,
                abreviarRecinto(labels[value as number] ?? ""),
              );
            },
          },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colores.panel,
          titleColor: colores.ink,
          bodyColor: colores.ink,
          borderColor: colores.line,
          borderWidth: 1,
          callbacks: {
            title: (items) => labels[items[0]?.dataIndex ?? 0] ?? "",
            label: (ctx) => {
              const b = barras[ctx.dataIndex];
              return b
                ? `${serie}: ${b.cantidad} de ${b.requerido} (${b.pct}%)`
                : "";
            },
          },
        },
        datalabels: {
          color: colores.ink,
          anchor: "end",
          align: "end",
          font: { weight: "bold", size: 10 },
          formatter: (v: number) => `${v}%`,
        },
      },
    }),
    [labels, barras, serie],
  );

  const altura = Math.max(140, barras.length * 32 + 60);

  return (
    <ChartCanvas
      type="bar"
      data={data}
      buildOptions={buildOptions}
      height={altura}
      ariaLabel={`Gráfico de barras: ${serie}. ${barras
        .map((b) => `${b.etiqueta} ${b.pct}%`)
        .join(", ")}.`}
    />
  );
}
