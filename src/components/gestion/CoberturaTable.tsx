import { useMemo, useState } from "preact/hooks";
import { fmt } from "../../lib/format";

export interface CoberturaFila {
  recintoCodigo: number;
  parroquiaCodigo: number;
  nombreRecinto: string;
  nombreParroquia: string;
  urbana: boolean;
  tieneCoordinadorTitular: boolean;
  juntasCubiertas: number;
  juntasCubiertasVerificado: number;
  totalJuntas: number;
  pct: number;
  pctVerificado: number;
}

export interface ParroquiaOpcion {
  code: number;
  name: string;
  urbana: boolean;
}

interface Props {
  filas: CoberturaFila[];
  parroquias: ParroquiaOpcion[];
}

type Ambito = "todas" | "urbanas" | "rurales";

function pct(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 1000) / 10 : 0;
}

function colorFor(pctValue: number): string {
  const hue = Math.round((pctValue / 100) * 120);
  return `hsl(${hue}, 65%, 45%)`;
}

export default function CoberturaTable({ filas, parroquias }: Props) {
  const [ambito, setAmbito] = useState<Ambito>("todas");
  const [parroquiaCod, setParroquiaCod] = useState<number | "">("");

  const parroquiasOpciones = useMemo(
    () =>
      parroquias
        .filter((p) =>
          ambito === "todas" ? true : p.urbana === (ambito === "urbanas"),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [parroquias, ambito],
  );

  const filasFiltradas = useMemo(() => {
    const conParroquiaValida =
      parroquiaCod !== "" &&
      parroquiasOpciones.some((p) => p.code === parroquiaCod);
    return filas
      .filter((f) => {
        if (ambito === "urbanas" && !f.urbana) return false;
        if (ambito === "rurales" && f.urbana) return false;
        if (conParroquiaValida && f.parroquiaCodigo !== parroquiaCod)
          return false;
        return true;
      })
      .sort((a, b) => a.pct - b.pct);
  }, [filas, ambito, parroquiaCod, parroquiasOpciones]);

  const totalJuntas = filasFiltradas.reduce((a, f) => a + f.totalJuntas, 0);
  const totalCubiertas = filasFiltradas.reduce(
    (a, f) => a + f.juntasCubiertas,
    0,
  );
  const totalCubiertasVerificado = filasFiltradas.reduce(
    (a, f) => a + f.juntasCubiertasVerificado,
    0,
  );
  const pctGlobal = pct(totalCubiertas, totalJuntas);
  const pctVerificadoGlobal = pct(totalCubiertasVerificado, totalJuntas);

  return (
    <div class="g-panel">
      <div class="g-selects">
        <label>
          Ámbito
          <select
            value={ambito}
            onChange={(e) => {
              const value = (e.currentTarget as HTMLSelectElement)
                .value as Ambito;
              setAmbito(value);
              setParroquiaCod("");
            }}
          >
            <option value="todas">Todas</option>
            <option value="urbanas">Urbanas</option>
            <option value="rurales">Rurales</option>
          </select>
        </label>
        <label>
          Parroquia
          <select
            value={parroquiaCod}
            onChange={(e) =>
              setParroquiaCod(
                Number((e.currentTarget as HTMLSelectElement).value) || "",
              )
            }
          >
            <option value="">Todas</option>
            {parroquiasOpciones.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div class="g-summary">
        <div class="g-summary-item">
          <b>
            {fmt(totalCubiertas)} / {fmt(totalJuntas)}
          </b>
          <small>juntas cubiertas</small>
        </div>
        <div class="g-summary-item">
          <b>{pctGlobal}%</b>
          <small>cobertura</small>
        </div>
        <div class="g-summary-item">
          <b>
            {fmt(totalCubiertasVerificado)} / {fmt(totalJuntas)}
          </b>
          <small>juntas cubiertas y verificadas</small>
        </div>
        <div class="g-summary-item">
          <b>{pctVerificadoGlobal}%</b>
          <small>cobertura verificada</small>
        </div>
      </div>

      {filasFiltradas.length === 0 ? (
        <p class="g-empty">No hay recintos para este filtro.</p>
      ) : (
        <div class="g-table-scroll">
          <table class="g-table">
            <thead>
              <tr>
                <th>Parroquia</th>
                <th>Recinto</th>
                <th>Coordinador</th>
                <th>Juntas cubiertas</th>
                <th>% cobertura</th>
                <th>% cobertura verificada</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((f) => (
                <tr key={f.recintoCodigo}>
                  <td>{f.nombreParroquia}</td>
                  <td>{f.nombreRecinto}</td>
                  <td>{f.tieneCoordinadorTitular ? "Sí" : "No"}</td>
                  <td>
                    {f.juntasCubiertas} / {f.totalJuntas}
                  </td>
                  <td>
                    <div class="g-bar">
                      <span
                        style={`width:${f.pct}%; background:${colorFor(f.pct)}`}
                      />
                    </div>
                    {f.pct}%
                  </td>
                  <td>
                    <div class="g-bar">
                      <span
                        style={`width:${f.pctVerificado}%; background:${colorFor(f.pctVerificado)}`}
                      />
                    </div>
                    {f.pctVerificado}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
