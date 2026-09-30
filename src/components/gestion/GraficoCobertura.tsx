import { useCallback, useMemo, useState } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas, { type TemaColores } from "./ChartCanvas";
import { extraerPct, extraerPctRecinto } from "../../lib/gestion/coverage";
import { title } from "../../lib/format";
import { COLOR_VERIFICADO } from "../../lib/gestion/chartColors";
import type {
  CoberturaCanton,
  CoberturaParroquia,
  CoberturaRecinto,
  CoberturaTrack,
} from "../../lib/gestion/types";
import type { ParroquiaFeature, Recinto } from "../../lib/types";

type Nivel = "canton" | "parroquia" | "recinto";

interface Props {
  track: CoberturaTrack;
  titulo: string;
  canton: CoberturaCanton;
  porParroquia: Record<number, CoberturaParroquia>;
  porRecinto: CoberturaRecinto[];
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
}

function colorSerie1(ctx: { chart: { canvas: HTMLCanvasElement } }): string {
  return (
    getComputedStyle(ctx.chart.canvas).getPropertyValue("--series-1").trim() ||
    "#2a78d6"
  );
}

export default function GraficoCobertura({
  track,
  titulo,
  canton,
  porParroquia,
  porRecinto,
  parroquias,
  recintos,
}: Props) {
  const [nivel, setNivel] = useState<Nivel>("canton");

  const recintoByCode = useMemo(
    () => new Map(recintos.map((r) => [r.cod, r])),
    [recintos],
  );

  const { labels, cobertura, verificado } = useMemo(() => {
    if (nivel === "canton") {
      const { pct, pctVerificado } = extraerPct(track, canton);
      return { labels: ["Cantón"], cobertura: [pct], verificado: [pctVerificado] };
    }
    if (nivel === "parroquia") {
      const filas = parroquias
        .map((p) => {
          const c = porParroquia[p.properties.code];
          if (!c) return null;
          const { pct, pctVerificado } = extraerPct(track, c);
          return { nombre: p.properties.name, pct, pctVerificado };
        })
        .filter((f): f is { nombre: string; pct: number; pctVerificado: number } => f !== null)
        .sort((a, b) => b.pct - a.pct);
      return {
        labels: filas.map((f) => f.nombre),
        cobertura: filas.map((f) => f.pct),
        verificado: filas.map((f) => f.pctVerificado),
      };
    }
    const filas = porRecinto
      .map((r) => {
        const datos = extraerPctRecinto(track, r);
        if (!datos) return null;
        const nombre = title(recintoByCode.get(r.recintoCodigo)?.nombre ?? "");
        return { nombre, ...datos };
      })
      .filter(
        (f): f is { nombre: string; pct: number; pctVerificado: number } =>
          f !== null,
      )
      .sort((a, b) => b.pct - a.pct);
    return {
      labels: filas.map((f) => f.nombre),
      cobertura: filas.map((f) => f.pct),
      verificado: filas.map((f) => f.pctVerificado),
    };
  }, [nivel, track, canton, porParroquia, porRecinto, parroquias, recintoByCode]);

  const data: ChartData<"bar"> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Cobertura",
          data: cobertura,
          backgroundColor: colorSerie1,
          borderRadius: 4,
          maxBarThickness: 28,
        },
        {
          label: "Verificado",
          data: verificado,
          backgroundColor: COLOR_VERIFICADO,
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    }),
    [labels, cobertura, verificado],
  );

  const buildOptions = useCallback(
    (colores: TemaColores): ChartOptions<"bar"> => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: colores.muted,
            autoSkip: false,
            maxRotation: nivel === "canton" ? 0 : 60,
            minRotation: nivel === "canton" ? 0 : 60,
          },
          grid: { display: false },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: colores.muted, callback: (v) => `${v}%` },
          grid: { color: colores.chartGrid },
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
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}%`,
          },
        },
        datalabels: {
          color: colores.ink,
          anchor: "end",
          align: "top",
          font: { weight: "bold", size: 10 },
          formatter: (v: number) => `${v}%`,
        },
      },
    }),
    [nivel],
  );

  const grafico = (
    <ChartCanvas
      type="bar"
      data={data}
      buildOptions={buildOptions}
      height={nivel === "canton" ? 240 : 320}
    />
  );

  return (
    <div class="g-panel">
      <div class="g-selects">
        <label>
          Nivel
          <select
            value={nivel}
            onChange={(e) =>
              setNivel((e.currentTarget as HTMLSelectElement).value as Nivel)
            }
          >
            <option value="canton">Cantón</option>
            <option value="parroquia">Parroquia</option>
            <option value="recinto">Recinto</option>
          </select>
        </label>
      </div>
      {labels.length === 0 ? (
        <p class="g-empty">No hay datos para {titulo.toLowerCase()} en este nivel.</p>
      ) : nivel === "recinto" ? (
        <div class="g-chart-scroll">
          <div style={{ minWidth: `${Math.max(600, labels.length * 46)}px` }}>
            {grafico}
          </div>
        </div>
      ) : (
        grafico
      )}
    </div>
  );
}
