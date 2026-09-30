import { useMemo, useRef, useState } from "preact/hooks";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { EventoActividad } from "../../lib/gestion/types";

interface Props {
  eventos: EventoActividad[];
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
}

const W = 680;
const H = 320;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 44 };

function enumerarDias(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const cursor = new Date(desde + "T00:00:00Z");
  const fin = new Date(hasta + "T00:00:00Z");
  while (cursor <= fin) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

function formatearFecha(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default function GraficoCrecimiento({
  eventos,
  parroquias,
  recintos,
}: Props) {
  const [parroquiaCod, setParroquiaCod] = useState<number | "">("");
  const [recintoCod, setRecintoCod] = useState<number | "">("");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const recintosDeParroquia = useMemo(
    () => recintos.filter((r) => r.par === parroquiaCod),
    [recintos, parroquiaCod],
  );

  const eventosFiltrados = useMemo(
    () =>
      eventos.filter((e) => {
        if (recintoCod !== "") return e.recintoCodigo === recintoCod;
        if (parroquiaCod !== "") return e.parroquiaCodigo === parroquiaCod;
        return true;
      }),
    [eventos, parroquiaCod, recintoCod],
  );

  const { dias, veedorSerie, coordinadorSerie, cdaSerie } = useMemo(() => {
    if (eventosFiltrados.length === 0)
      return {
        dias: [] as string[],
        veedorSerie: [],
        coordinadorSerie: [],
        cdaSerie: [],
      };
    const fechas = eventosFiltrados.map((e) => e.fecha).sort();
    const hoy = new Date().toISOString().slice(0, 10);
    const dias = enumerarDias(
      fechas[0],
      fechas[fechas.length - 1] > hoy ? fechas[fechas.length - 1] : hoy,
    );

    let netoV = 0;
    let netoC = 0;
    let netoCda = 0;
    const veedorSerie: number[] = [];
    const coordinadorSerie: number[] = [];
    const cdaSerie: number[] = [];
    for (const dia of dias) {
      for (const e of eventosFiltrados) {
        if (e.fecha !== dia) continue;
        if (e.tipo === "alta_veedor") netoV += 1;
        else if (e.tipo === "baja_veedor") netoV -= 1;
        else if (e.tipo === "alta_coordinador") netoC += 1;
        else if (e.tipo === "baja_coordinador") netoC -= 1;
        else if (e.tipo === "alta_acreditado_cda") netoCda += 1;
        else if (e.tipo === "baja_acreditado_cda") netoCda -= 1;
      }
      veedorSerie.push(netoV);
      coordinadorSerie.push(netoC);
      cdaSerie.push(netoCda);
    }
    return { dias, veedorSerie, coordinadorSerie, cdaSerie };
  }, [eventosFiltrados]);

  if (eventos.length === 0) {
    return (
      <div class="g-panel">
        <Filtros
          parroquias={parroquias}
          recintosDeParroquia={recintosDeParroquia}
          parroquiaCod={parroquiaCod}
          recintoCod={recintoCod}
          setParroquiaCod={setParroquiaCod}
          setRecintoCod={setRecintoCod}
        />
        <p class="g-empty">
          Todavía no hay altas ni bajas de veedores, coordinadores o
          acreditados CDA registradas. El gráfico se irá llenando a medida
          que se use la gestión.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(1, ...veedorSerie, ...coordinadorSerie, ...cdaSerie);
  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;
  const x = (i: number) =>
    MARGIN.left + (dias.length <= 1 ? 0 : (i / (dias.length - 1)) * innerW);
  const y = (v: number) => MARGIN.top + innerH - (v / maxVal) * innerH;

  const pathFor = (serie: number[]) =>
    serie.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  const ticks = Math.min(4, maxVal);
  const yTicks = Array.from(
    new Set(
      Array.from({ length: ticks + 1 }, (_, i) =>
        Math.round((maxVal / ticks) * i),
      ),
    ),
  );

  const onMove = (e: MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((relX - MARGIN.left) / innerW) * (dias.length - 1));
    setHoverIdx(Math.max(0, Math.min(dias.length - 1, idx)));
  };

  return (
    <div class="g-panel">
      <Filtros
        parroquias={parroquias}
        recintosDeParroquia={recintosDeParroquia}
        parroquiaCod={parroquiaCod}
        recintoCod={recintoCod}
        setParroquiaCod={setParroquiaCod}
        setRecintoCod={setRecintoCod}
      />

      <div class="g-chart">
        <div class="g-chart-legend">
          <span>
            <i style={{ background: "var(--series-1)" }} /> Veedores (neto)
          </span>
          <span>
            <i style={{ background: "var(--series-2)" }} /> Coordinadores (neto)
          </span>
          <span>
            <i style={{ background: "var(--series-3)" }} /> Acreditados CDA (neto)
          </span>
        </div>
        <div class="g-chart-wrap">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            onMouseMove={onMove}
            onMouseLeave={() => setHoverIdx(null)}
            role="img"
            aria-label="Crecimiento diario neto de veedores, coordinadores y acreditados CDA"
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={W - MARGIN.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--chart-grid)"
                  stroke-width={1}
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(t)}
                  text-anchor="end"
                  dominant-baseline="middle"
                  fill="var(--muted)"
                  font-size="10"
                >
                  {t}
                </text>
              </g>
            ))}
            <line
              x1={MARGIN.left}
              x2={W - MARGIN.right}
              y1={H - MARGIN.bottom}
              y2={H - MARGIN.bottom}
              stroke="var(--chart-axis)"
              stroke-width={1}
            />
            {dias.map((d, i) =>
              i % Math.ceil(dias.length / 6 || 1) === 0 ? (
                <text
                  key={d}
                  x={x(i)}
                  y={H - MARGIN.bottom + 16}
                  text-anchor="middle"
                  fill="var(--muted)"
                  font-size="10"
                >
                  {formatearFecha(d)}
                </text>
              ) : null,
            )}

            <path
              d={pathFor(veedorSerie)}
              fill="none"
              stroke="var(--series-1)"
              stroke-width={2}
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d={pathFor(coordinadorSerie)}
              fill="none"
              stroke="var(--series-2)"
              stroke-width={2}
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d={pathFor(cdaSerie)}
              fill="none"
              stroke="var(--series-3)"
              stroke-width={2}
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            {hoverIdx !== null ? (
              <>
                <line
                  x1={x(hoverIdx)}
                  x2={x(hoverIdx)}
                  y1={MARGIN.top}
                  y2={H - MARGIN.bottom}
                  stroke="var(--chart-axis)"
                  stroke-width={1}
                />
                <circle
                  cx={x(hoverIdx)}
                  cy={y(veedorSerie[hoverIdx])}
                  r={5}
                  fill="var(--series-1)"
                  stroke="var(--chart-surface)"
                  stroke-width={2}
                />
                <circle
                  cx={x(hoverIdx)}
                  cy={y(coordinadorSerie[hoverIdx])}
                  r={5}
                  fill="var(--series-2)"
                  stroke="var(--chart-surface)"
                  stroke-width={2}
                />
                <circle
                  cx={x(hoverIdx)}
                  cy={y(cdaSerie[hoverIdx])}
                  r={5}
                  fill="var(--series-3)"
                  stroke="var(--chart-surface)"
                  stroke-width={2}
                />
              </>
            ) : null}
          </svg>
          {hoverIdx !== null ? (
            <div
              class="g-chart-tooltip"
              style={{ left: `${(x(hoverIdx) / W) * 100}%`, top: 0 }}
            >
              <div>{formatearFecha(dias[hoverIdx])}</div>
              <div>
                Veedores:{" "}
                <span class="g-tt-value">{veedorSerie[hoverIdx]}</span>
              </div>
              <div>
                Coordinadores:{" "}
                <span class="g-tt-value">{coordinadorSerie[hoverIdx]}</span>
              </div>
              <div>
                Acreditados CDA:{" "}
                <span class="g-tt-value">{cdaSerie[hoverIdx]}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div class="g-table-scroll">
        <table class="g-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Veedores (neto)</th>
              <th>Coordinadores (neto)</th>
              <th>Acreditados CDA (neto)</th>
            </tr>
          </thead>
          <tbody>
            {dias.map((d, i) => (
              <tr key={d}>
                <td>{d}</td>
                <td>{veedorSerie[i]}</td>
                <td>{coordinadorSerie[i]}</td>
                <td>{cdaSerie[i]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filtros({
  parroquias,
  recintosDeParroquia,
  parroquiaCod,
  recintoCod,
  setParroquiaCod,
  setRecintoCod,
}: {
  parroquias: ParroquiaFeature[];
  recintosDeParroquia: Recinto[];
  parroquiaCod: number | "";
  recintoCod: number | "";
  setParroquiaCod: (v: number | "") => void;
  setRecintoCod: (v: number | "") => void;
}) {
  return (
    <div class="g-selects">
      <label>
        Parroquia
        <select
          value={parroquiaCod}
          onChange={(e) => {
            setParroquiaCod(
              Number((e.currentTarget as HTMLSelectElement).value) || "",
            );
            setRecintoCod("");
          }}
        >
          <option value="">Todo el cantón</option>
          {parroquias
            .slice()
            .sort((a, b) => a.properties.name.localeCompare(b.properties.name))
            .map((p) => (
              <option key={p.properties.code} value={p.properties.code}>
                {p.properties.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Recinto
        <select
          value={recintoCod}
          disabled={!parroquiaCod}
          onChange={(e) =>
            setRecintoCod(
              Number((e.currentTarget as HTMLSelectElement).value) || "",
            )
          }
        >
          <option value="">Toda la parroquia</option>
          {recintosDeParroquia.map((r) => (
            <option key={r.cod} value={r.cod}>
              {r.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
