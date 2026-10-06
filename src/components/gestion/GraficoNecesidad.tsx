import { useCallback, useMemo } from "preact/hooks";
import type { ChartData, ChartOptions } from "chart.js";
import ChartCanvas, { type TemaColores } from "./ChartCanvas";

interface Puesto {
  necesarios: number;
  cubiertos: number;
}

interface Props {
  // Universo necesario: un titular por junta, por recinto y por recinto CDA.
  veedores: Puesto;
  coordinadores: Puesto;
  cda: Puesto;
  // Registros de personas (bandeja de Militancia más veedores, coordinadores
  // y acreditados CDA) y cuántas personas distintas son, por cédula.
  registros: number;
  unicas: number;
}

// Colores definidos como tokens (--necesidad-*) en .g-chart; contraste
// suficiente para la etiqueta blanca y sin el verde/rojo de "cubierto / sin
// cubrir" del resto de la gestión.
function colorDePorcion(ctx: {
  dataIndex: number;
  chart: { canvas: HTMLCanvasElement };
}): string {
  const cs = getComputedStyle(ctx.chart.canvas);
  return ctx.dataIndex === 0
    ? cs.getPropertyValue("--necesidad-tenemos").trim() || "#1d5fb8"
    : cs.getPropertyValue("--necesidad-faltan").trim() || "#b8501a";
}

export default function GraficoNecesidad({
  veedores,
  coordinadores,
  cda,
  registros,
  unicas,
}: Props) {
  const universo =
    veedores.necesarios + coordinadores.necesarios + cda.necesarios;
  const cubiertos =
    veedores.cubiertos + coordinadores.cubiertos + cda.cubiertos;
  const repetidos = Math.max(0, registros - unicas);
  const faltan = Math.max(0, universo - unicas);
  const excedente = Math.max(0, unicas - universo);
  const tenemos = Math.min(unicas, universo);

  const data: ChartData<"pie"> = useMemo(
    () => ({
      labels: [
        `Militancia sin repetidos: ${unicas}`,
        excedente > 0
          ? "Sin personas por conseguir: 0"
          : `Por conseguir: ${faltan}`,
      ],
      datasets: [
        {
          data: [tenemos, faltan],
          backgroundColor: colorDePorcion,
          borderWidth: 2,
          borderColor: "transparent",
        },
      ],
    }),
    [unicas, faltan, tenemos, excedente],
  );

  const buildOptions = useCallback(
    (colores: TemaColores): ChartOptions<"pie"> => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 8 },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: colores.ink, font: { size: 14 }, padding: 14 },
        },
        tooltip: {
          backgroundColor: colores.panel,
          titleColor: colores.ink,
          bodyColor: colores.ink,
          borderColor: colores.line,
          borderWidth: 1,
          callbacks: {
            label: (ctx) =>
              ctx.dataIndex === 0
                ? `Personas distintas: ${unicas}`
                : `Faltan ${faltan} para cubrir ${universo} puestos`,
            afterLabel: (ctx) =>
              ctx.dataIndex === 0
                ? [
                    `Registros: ${registros}`,
                    `Repetidos descartados: ${repetidos}`,
                  ]
                : [
                    `Veedores: ${veedores.necesarios}`,
                    `Coordinadores: ${coordinadores.necesarios}`,
                    `Acreditados CDA: ${cda.necesarios}`,
                  ],
          },
        },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 16 },
          textAlign: "center",
          formatter: (valor: number, ctx) => {
            const total = (ctx.dataset.data as number[]).reduce(
              (a, b) => a + b,
              0,
            );
            if (total === 0 || valor === 0 || valor / total < 0.04) return "";
            return `${valor}\n${Math.round((valor / total) * 100)}%`;
          },
        },
      },
    }),
    [
      unicas,
      faltan,
      universo,
      registros,
      repetidos,
      veedores,
      coordinadores,
      cda,
    ],
  );

  return (
    <div class="g-necesidad">
      <ChartCanvas
        type="pie"
        data={data}
        buildOptions={buildOptions}
        height={440}
        ariaLabel={`Gráfico de pastel: ${unicas} personas distintas en la militancia frente a ${universo} puestos necesarios; ${excedente > 0 ? `sobran ${excedente}` : `faltan ${faltan}`}.`}
      />
      <dl class="g-necesidad-lista">
        <div>
          <dt>Universo necesario</dt>
          <dd>
            <strong>{universo}</strong> puestos ({veedores.necesarios} veedores
            · {coordinadores.necesarios} coordinadores · {cda.necesarios}{" "}
            acreditados CDA)
          </dd>
        </div>
        <div>
          <dt>Militancia sin repetidos</dt>
          <dd>
            <strong>{unicas}</strong> personas distintas, de {registros}{" "}
            registros ({repetidos} repetidos descartados)
          </dd>
        </div>
        <div>
          <dt>{excedente > 0 ? "Excedente" : "Por conseguir"}</dt>
          <dd>
            <strong>{excedente > 0 ? excedente : faltan}</strong>{" "}
            {excedente > 0
              ? "personas más que puestos"
              : "personas para cubrir todos los puestos"}
          </dd>
        </div>
        <div>
          <dt>Puestos con titular</dt>
          <dd>
            <strong>{cubiertos}</strong> de {universo}
          </dd>
        </div>
      </dl>
    </div>
  );
}
