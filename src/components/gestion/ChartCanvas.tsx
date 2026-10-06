import { useEffect, useRef } from "preact/hooks";
import {
  Chart,
  BarController,
  DoughnutController,
  PieController,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(
  BarController,
  DoughnutController,
  PieController,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  ChartDataLabels,
);

export interface TemaColores {
  ink: string;
  muted: string;
  line: string;
  panel: string;
  chartGrid: string;
}

// Chart.js pinta en <canvas>, no puede leer variables CSS en vivo: se leen
// del elemento (que hereda las de su ancestro .g-chart, incluida --series-1
// que sí cambia entre temas) cada vez que hace falta reconstruir opciones.
export function leerColoresTema(el: HTMLElement): TemaColores {
  const cs = getComputedStyle(el);
  const get = (nombre: string, fallback: string) =>
    cs.getPropertyValue(nombre).trim() || fallback;
  return {
    ink: get("--ink", "#14283d"),
    muted: get("--muted", "#5a6b7d"),
    line: get("--line", "#c9d3dd"),
    panel: get("--panel", "#ffffff"),
    chartGrid: get("--chart-grid", "#e1e0d9"),
  };
}

interface Props {
  type: "bar" | "doughnut" | "pie";
  data: ChartData;
  buildOptions: (colores: TemaColores) => ChartOptions;
  height?: number;
}

export default function ChartCanvas({
  type,
  data,
  buildOptions,
  height = 300,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const dataRef = useRef(data);
  const buildOptionsRef = useRef(buildOptions);
  dataRef.current = data;
  buildOptionsRef.current = buildOptions;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    chartRef.current = new Chart(canvas, {
      type,
      data: dataRef.current,
      options: buildOptionsRef.current(leerColoresTema(canvas)),
    });

    const actualizarTema = () => {
      const chart = chartRef.current;
      if (!chart) return;
      chart.options = buildOptionsRef.current(leerColoresTema(canvas));
      chart.update();
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", actualizarTema);
    const observer = new MutationObserver(actualizarTema);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      media.removeEventListener("change", actualizarTema);
      observer.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [type]);

  useEffect(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas) return;
    chart.data = data;
    chart.options = buildOptions(leerColoresTema(canvas));
    chart.update();
  }, [data, buildOptions]);

  return (
    <div class="g-chart">
      <div class="g-chart-wrap" style={{ height: `${height}px` }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
