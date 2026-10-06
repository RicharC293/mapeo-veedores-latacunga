import { useCallback, useMemo } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas, { type TemaColores } from "./ChartCanvas";
import { totalesDeTrack } from "../../lib/gestion/coverage";
import {
  COLOR_PENDIENTE,
  COLOR_VERIFICADO,
} from "../../lib/gestion/chartColors";
import type { CoberturaCanton, CoberturaTrack } from "../../lib/gestion/types";

interface Props {
  track: CoberturaTrack;
  titulo: string;
  canton: CoberturaCanton;
}

function segmentoColor(ctx: {
  dataIndex: number;
  chart: { canvas: HTMLCanvasElement };
}): string {
  if (ctx.dataIndex === 1) {
    return (
      getComputedStyle(ctx.chart.canvas)
        .getPropertyValue("--series-1")
        .trim() || "#2a78d6"
    );
  }
  return ctx.dataIndex === 0 ? COLOR_VERIFICADO : COLOR_PENDIENTE;
}

export default function GraficoPastelCobertura({
  track,
  titulo,
  canton,
}: Props) {
  const { total, cubiertos, verificados } = totalesDeTrack(track, canton);
  const sinVerificar = Math.max(0, cubiertos - verificados);
  const sinCubrir = Math.max(0, total - cubiertos);

  const data: ChartData<"doughnut"> = useMemo(
    () => ({
      labels: ["Cubierto y verificado", "Cubierto sin verificar", "Sin cubrir"],
      datasets: [
        {
          data: [verificados, sinVerificar, sinCubrir],
          backgroundColor: segmentoColor,
          borderWidth: 0,
        },
      ],
    }),
    [verificados, sinVerificar, sinCubrir],
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
            const datos = (ctx.dataset.data as number[]).reduce(
              (a, b) => a + b,
              0,
            );
            if (datos === 0 || valor === 0) return "";
            return `${Math.round((valor / datos) * 100)}%`;
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
      ariaLabel={`Gráfico de pastel: ${titulo}. ${verificados} verificados, ${sinVerificar} sin verificar y ${sinCubrir} sin cubrir de ${total}.`}
    />
  );
}
