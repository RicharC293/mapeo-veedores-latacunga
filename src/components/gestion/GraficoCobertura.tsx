import { useCallback, useMemo, useState } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas, { type TemaColores } from "./ChartCanvas";
import { etiquetaAjustada } from "./etiquetaEje";
import { extraerPct, extraerPctRecinto } from "../../lib/gestion/coverage";
import { title } from "../../lib/format";
import {
  ESPACIO_ROTULO_DERECHO,
  abreviarRecinto,
  anchoEtiquetas,
} from "../../lib/gestion/chartLayout";
import { COLOR_VERIFICADO } from "../../lib/gestion/chartColors";
import type {
  CoberturaCanton,
  CoberturaParroquia,
  CoberturaRecinto,
  CoberturaTrack,
} from "../../lib/gestion/types";
import type { ParroquiaFeature, Recinto } from "../../lib/types";

type Nivel = "canton" | "parroquia" | "recinto";
type Ambito = "todas" | "urbanas" | "rurales";

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
  const [ambito, setAmbito] = useState<Ambito>("todas");
  const [parroquiaFiltro, setParroquiaFiltro] = useState<number | "">("");

  const recintoByCode = useMemo(
    () => new Map(recintos.map((r) => [r.cod, r])),
    [recintos],
  );

  const parByCode = useMemo(
    () => new Map(parroquias.map((p) => [p.properties.code, p])),
    [parroquias],
  );

  const parroquiasOpciones = useMemo(
    () =>
      parroquias
        .filter((p) =>
          ambito === "todas"
            ? true
            : p.properties.urbana === (ambito === "urbanas"),
        )
        .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
    [parroquias, ambito],
  );

  const { labels, cobertura, verificado } = useMemo(() => {
    if (nivel === "canton") {
      const { pct, pctVerificado } = extraerPct(track, canton);
      return {
        labels: ["Cantón"],
        cobertura: [pct],
        verificado: [pctVerificado],
      };
    }
    if (nivel === "parroquia") {
      const filas = parroquias
        .filter((p) =>
          ambito === "todas"
            ? true
            : p.properties.urbana === (ambito === "urbanas"),
        )
        .map((p) => {
          const c = porParroquia[p.properties.code];
          if (!c) return null;
          const { pct, pctVerificado } = extraerPct(track, c);
          return { nombre: p.properties.name, pct, pctVerificado };
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
    }
    const filas = porRecinto
      .filter((r) => {
        if (parroquiaFiltro !== "" && r.parroquiaCodigo !== parroquiaFiltro) {
          return false;
        }
        if (ambito !== "todas") {
          const urbana =
            parByCode.get(r.parroquiaCodigo)?.properties.urbana ?? false;
          if (urbana !== (ambito === "urbanas")) return false;
        }
        return true;
      })
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
  }, [
    nivel,
    track,
    canton,
    porParroquia,
    porRecinto,
    parroquias,
    recintoByCode,
    parByCode,
    ambito,
    parroquiaFiltro,
  ]);

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
        legend: { labels: { color: colores.ink } },
        tooltip: {
          backgroundColor: colores.panel,
          titleColor: colores.ink,
          bodyColor: colores.ink,
          borderColor: colores.line,
          borderWidth: 1,
          callbacks: {
            title: (items) => labels[items[0]?.dataIndex ?? 0] ?? "",
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue}%`,
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
    [labels],
  );

  const alturaPorFila = nivel === "parroquia" ? 42 : 30;
  const altura =
    nivel === "canton"
      ? 140
      : Math.max(220, labels.length * alturaPorFila + 60);

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
        {nivel !== "canton" ? (
          <label>
            Ámbito
            <select
              value={ambito}
              onChange={(e) => {
                const value = (e.currentTarget as HTMLSelectElement)
                  .value as Ambito;
                setAmbito(value);
                setParroquiaFiltro("");
              }}
            >
              <option value="todas">Todas</option>
              <option value="urbanas">Urbanas</option>
              <option value="rurales">Rurales</option>
            </select>
          </label>
        ) : null}
        {nivel === "recinto" ? (
          <label>
            Parroquia
            <select
              value={parroquiaFiltro}
              onChange={(e) =>
                setParroquiaFiltro(
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
                )
              }
            >
              <option value="">Todas</option>
              {parroquiasOpciones.map((p) => (
                <option key={p.properties.code} value={p.properties.code}>
                  {p.properties.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {labels.length === 0 ? (
        <p class="g-empty">
          No hay datos para {titulo.toLowerCase()} en este nivel.
        </p>
      ) : (
        <ChartCanvas
          type="bar"
          data={data}
          buildOptions={buildOptions}
          height={altura}
        />
      )}
    </div>
  );
}
