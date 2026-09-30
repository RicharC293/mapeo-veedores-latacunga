import { useMemo, useState } from "preact/hooks";
import { listJuntasDeRecinto } from "../../lib/gestion/juntas";
import { title } from "../../lib/format";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { Lider, Militante, TipoMilitancia } from "../../lib/gestion/types";
import type { AsignarDestino } from "../../lib/gestion/militancia";

type TipoParroquiaFiltro = "todas" | "urbanas" | "rurales";

interface Props {
  militante: Militante;
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  lideres: Lider[];
  onAsignar: (destino: AsignarDestino) => Promise<void>;
  onEliminar: () => Promise<void>;
}

const TIPO_LABEL: Record<TipoMilitancia, string> = {
  veedor: "Veedor",
  coordinador: "Coordinador",
  cda: "Acreditado CDA",
};

export default function MilitanteRow({
  militante,
  parroquias,
  recintos,
  lideres,
  onAsignar,
  onEliminar,
}: Props) {
  const parroquiaPreasignada = parroquias.find(
    (p) => p.properties.code === militante.parroquiaCodigo,
  );

  const [tipoParroquia, setTipoParroquia] = useState<TipoParroquiaFiltro>(
    parroquiaPreasignada
      ? parroquiaPreasignada.properties.urbana
        ? "urbanas"
        : "rurales"
      : "todas",
  );
  const [parroquiaCod, setParroquiaCod] = useState<number | "">(
    militante.parroquiaCodigo ?? "",
  );
  const [recintoCod, setRecintoCod] = useState<number | "">(
    militante.recintoCodigo ?? "",
  );
  const [tipo, setTipo] = useState<TipoMilitancia | "">(
    militante.tipoPreasignado ?? "",
  );
  const [juntaSel, setJuntaSel] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const responsable = lideres.find((l) => l.id === militante.responsableLiderId);

  const parroquiasFiltradas = useMemo(
    () =>
      parroquias
        .filter((p) =>
          tipoParroquia === "todas"
            ? true
            : p.properties.urbana === (tipoParroquia === "urbanas"),
        )
        .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
    [parroquias, tipoParroquia],
  );

  const recintosDeParroquia = useMemo(
    () =>
      recintos
        .filter((r) => r.par === parroquiaCod)
        .filter((r) => tipo !== "cda" || r.cda)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [recintos, parroquiaCod, tipo],
  );

  const recinto = recintos.find((r) => r.cod === recintoCod) ?? null;
  const juntas = useMemo(
    () => (recinto && tipo === "veedor" ? listJuntasDeRecinto(recinto) : []),
    [recinto, tipo],
  );

  const puedeAsignar =
    !militante.duplicado &&
    parroquiaCod !== "" &&
    recintoCod !== "" &&
    tipo !== "" &&
    (tipo !== "veedor" || juntaSel !== "");

  const asignar = async () => {
    if (!puedeAsignar) return;
    setError(null);
    setEnviando(true);
    try {
      let destino: AsignarDestino;
      if (tipo === "veedor") {
        const junta = juntas.find((j) => j.id === juntaSel);
        if (!junta) throw new Error("Elige una junta.");
        destino = {
          tipo: "veedor",
          recintoCodigo: recintoCod as number,
          parroquiaCodigo: parroquiaCod as number,
          genero: junta.genero,
          numero: junta.numero,
        };
      } else {
        destino = {
          tipo,
          recintoCodigo: recintoCod as number,
          parroquiaCodigo: parroquiaCod as number,
        };
      }
      await onAsignar(destino);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setEnviando(false);
    }
  };

  const eliminar = async () => {
    setError(null);
    setEnviando(true);
    try {
      await onEliminar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setEnviando(false);
    }
  };

  return (
    <tr>
      <td>
        {militante.cedula}
        {militante.duplicado ? (
          <span class="chip-estado chip-estado-pendiente">Duplicado</span>
        ) : null}
      </td>
      <td>{militante.nombres}</td>
      <td>{militante.telefono || "—"}</td>
      <td>{responsable?.nombres ?? "—"}</td>
      <td>
        <select
          value={tipoParroquia}
          disabled={enviando}
          onChange={(e) => {
            setTipoParroquia(
              (e.currentTarget as HTMLSelectElement).value as TipoParroquiaFiltro,
            );
            setParroquiaCod("");
            setRecintoCod("");
          }}
        >
          <option value="todas">Todas</option>
          <option value="urbanas">Urbanas</option>
          <option value="rurales">Rurales</option>
        </select>
      </td>
      <td>
        <select
          value={parroquiaCod}
          disabled={enviando}
          onChange={(e) => {
            setParroquiaCod(
              Number((e.currentTarget as HTMLSelectElement).value) || "",
            );
            setRecintoCod("");
          }}
        >
          <option value="">Selecciona…</option>
          {parroquiasFiltradas.map((p) => (
            <option key={p.properties.code} value={p.properties.code}>
              {p.properties.name}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select
          value={tipo}
          disabled={enviando}
          onChange={(e) => {
            setTipo(
              (e.currentTarget as HTMLSelectElement).value as TipoMilitancia | "",
            );
            setRecintoCod("");
            setJuntaSel("");
          }}
        >
          <option value="">Selecciona…</option>
          <option value="veedor">{TIPO_LABEL.veedor}</option>
          <option value="coordinador">{TIPO_LABEL.coordinador}</option>
          <option value="cda">{TIPO_LABEL.cda}</option>
        </select>
      </td>
      <td>
        <select
          value={recintoCod}
          disabled={enviando || !parroquiaCod}
          onChange={(e) => {
            setRecintoCod(
              Number((e.currentTarget as HTMLSelectElement).value) || "",
            );
            setJuntaSel("");
          }}
        >
          <option value="">Selecciona…</option>
          {recintosDeParroquia.map((r) => (
            <option key={r.cod} value={r.cod}>
              {title(r.nombre)}
            </option>
          ))}
        </select>
      </td>
      <td>
        {tipo === "veedor" ? (
          <select
            value={juntaSel}
            disabled={enviando || !recinto}
            onChange={(e) =>
              setJuntaSel((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="">Selecciona…</option>
            {juntas.map((j) => (
              <option key={j.id} value={j.id}>
                {j.genero}
                {j.numero}
              </option>
            ))}
          </select>
        ) : (
          "—"
        )}
      </td>
      <td>
        <div class="g-row-actions">
          <button
            type="button"
            class="g-btn-icon g-btn-icon-ok"
            disabled={!puedeAsignar || enviando}
            title={
              militante.duplicado
                ? "Resuelve el duplicado antes de asignar"
                : "Asignar"
            }
            onClick={asignar}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M4 10.5l3.5 3.5L16 5.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="g-sr-only">Asignar</span>
          </button>
          <button
            type="button"
            class="g-btn-icon g-btn-icon-danger"
            disabled={enviando}
            title="Eliminar"
            onClick={eliminar}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <path
                d="M4.5 6h11M8 6V4.5h4V6M6.5 6l.7 9.5h5.6l.7-9.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="g-sr-only">Eliminar</span>
          </button>
        </div>
        {error ? <div class="g-table-row-error">{error}</div> : null}
      </td>
    </tr>
  );
}
