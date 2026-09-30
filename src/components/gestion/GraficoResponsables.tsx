import { useCallback, useMemo } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas, { type TemaColores } from "./ChartCanvas";
import { COLOR_VERIFICADO } from "../../lib/gestion/chartColors";
import type { Lider } from "../../lib/gestion/types";

interface Persona {
  responsableLiderId: string | null;
  verificado: boolean;
}

interface Props {
  titulo: string;
  lideres: Lider[];
  personas: Persona[];
}

function colorSerie1(ctx: { chart: { canvas: HTMLCanvasElement } }): string {
  return (
    getComputedStyle(ctx.chart.canvas).getPropertyValue("--series-1").trim() ||
    "#2a78d6"
  );
}

export default function GraficoResponsables({ titulo, lideres, personas }: Props) {
  const filas = useMemo(() => {
    const porLider = new Map<string | null, { total: number; verificados: number }>();
    for (const p of personas) {
      const actual = porLider.get(p.responsableLiderId) ?? {
        total: 0,
        verificados: 0,
      };
      actual.total += 1;
      if (p.verificado) actual.verificados += 1;
      porLider.set(p.responsableLiderId, actual);
    }
    const nombreDe = (id: string | null) =>
      id === null
        ? "Sin responsable"
        : (lideres.find((l) => l.id === id)?.nombres ?? "Líder eliminado");
    return Array.from(porLider.entries())
      .map(([id, v]) => ({ id, nombre: nombreDe(id), ...v }))
      .sort((a, b) => b.total - a.total);
  }, [personas, lideres]);

  const data: ChartData<"bar"> = useMemo(
    () => ({
      labels: filas.map((f) => f.nombre),
      datasets: [
        {
          label: "Asignados",
          data: filas.map((f) => f.total),
          backgroundColor: colorSerie1,
          borderRadius: 4,
          maxBarThickness: 22,
        },
        {
          label: "Verificados",
          data: filas.map((f) => f.verificados),
          backgroundColor: COLOR_VERIFICADO,
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    }),
    [filas],
  );

  const buildOptions = useCallback(
    (colores: TemaColores): ChartOptions<"bar"> => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: colores.muted, precision: 0 },
          grid: { color: colores.chartGrid },
        },
        y: {
          ticks: { color: colores.muted },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { labels: { color: colores.ink } },
        tooltip: {
          backgroundColor: colores.panel,
          titleColor: colores.ink,
          bodyColor: colores.ink,
          borderColor: colores.line,
          borderWidth: 1,
        },
        datalabels: {
          color: colores.ink,
          anchor: "end",
          align: "end",
          font: { weight: "bold", size: 10 },
        },
      },
    }),
    [],
  );

  if (filas.length === 0) {
    return <p class="g-empty">Todavía no hay {titulo.toLowerCase()} con responsable asignado.</p>;
  }

  return (
    <ChartCanvas
      type="bar"
      data={data}
      buildOptions={buildOptions}
      height={Math.max(160, filas.length * 36 + 60)}
    />
  );
}
