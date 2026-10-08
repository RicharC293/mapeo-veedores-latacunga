import { useMemo } from "preact/hooks";
import { leerUbicacion, type Ubicacion } from "../../lib/gestion/ubicacion";
import type { ParroquiaBasica } from "../../lib/types";

export interface OpcionEstado<E extends string> {
  clave: E;
  etiqueta: string;
  n: number;
  // Resalta el conteo cuando hay pendientes (p. ej. "Sin coordinador").
  alerta?: boolean;
}

interface Props<E extends string> {
  parroquias: ParroquiaBasica[];
  ubicacion: Ubicacion;
  onUbicacion: (u: Ubicacion) => void;
  estados: OpcionEstado<E>[];
  estado: E;
  onEstado: (e: E) => void;
  busqueda: string;
  onBusqueda: (q: string) => void;
  placeholder: string;
  contador: string;
  hayFiltros: boolean;
  onQuitar: () => void;
}

const porNombre = (a: ParroquiaBasica, b: ParroquiaBasica) =>
  a.properties.name.localeCompare(b.properties.name);

// Los tres filtros que comparten Coordinadores, Veedores y Acreditados CDA:
// una sola lista de ubicación (cantón, urbanas, rurales o una parroquia), el
// estado de cobertura y una búsqueda de texto.
export default function FiltrosRecintos<E extends string>({
  parroquias,
  ubicacion,
  onUbicacion,
  estados,
  estado,
  onEstado,
  busqueda,
  onBusqueda,
  placeholder,
  contador,
  hayFiltros,
  onQuitar,
}: Props<E>) {
  const urbanas = useMemo(
    () => parroquias.filter((p) => p.properties.urbana).sort(porNombre),
    [parroquias],
  );
  const rurales = useMemo(
    () => parroquias.filter((p) => !p.properties.urbana).sort(porNombre),
    [parroquias],
  );

  return (
    <>
      <div class="g-mil-filtros">
        <div class="g-mil-buscar">
          <label>
            Parroquia
            <select
              value={String(ubicacion)}
              onChange={(e) =>
                onUbicacion(
                  leerUbicacion((e.currentTarget as HTMLSelectElement).value),
                )
              }
            >
              <option value="todas">Todas las parroquias</option>
              {urbanas.length > 0 ? (
                <option value="urbanas">Solo urbanas</option>
              ) : null}
              {rurales.length > 0 ? (
                <option value="rurales">Solo rurales</option>
              ) : null}
              {urbanas.length > 0 ? (
                <optgroup label="Urbanas">
                  {urbanas.map((p) => (
                    <option key={p.properties.code} value={p.properties.code}>
                      {p.properties.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {rurales.length > 0 ? (
                <optgroup label="Rurales">
                  {rurales.map((p) => (
                    <option key={p.properties.code} value={p.properties.code}>
                      {p.properties.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label>
            Buscar
            <input
              type="search"
              value={busqueda}
              placeholder={placeholder}
              onInput={(e) =>
                onBusqueda((e.currentTarget as HTMLInputElement).value)
              }
            />
          </label>
        </div>
        <div class="g-mil-chips" role="group" aria-label="Estado">
          {estados.map((c) => (
            <button
              key={c.clave}
              type="button"
              class="g-chip-filtro"
              aria-pressed={estado === c.clave}
              data-alerta={c.alerta && c.n > 0 ? "true" : undefined}
              onClick={() => onEstado(c.clave)}
            >
              {c.etiqueta}
              <span class="g-chip-filtro-n">{c.n}</span>
            </button>
          ))}
        </div>
      </div>

      <p class="g-mil-contador" aria-live="polite">
        {contador}
        {hayFiltros ? (
          <>
            {" · "}
            <button type="button" class="g-btn-link" onClick={onQuitar}>
              Quitar filtros
            </button>
          </>
        ) : null}
      </p>
    </>
  );
}

export function ResumenAvance({
  parte,
  total,
  texto,
  etiquetaBarra,
}: {
  parte: number;
  total: number;
  texto: preact.ComponentChildren;
  etiquetaBarra: string;
}) {
  const pct = total > 0 ? Math.round((parte / total) * 100) : 0;
  return (
    <div class="g-avance">
      <p>
        {texto} ({pct}%)
      </p>
      <div
        class="g-avance-barra"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiquetaBarra}
      >
        <div class="g-avance-lleno" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function VacioFiltros({
  mensaje,
  onQuitar,
}: {
  mensaje: string;
  onQuitar: () => void;
}) {
  return (
    <div class="g-mil-vacio">
      <p>
        <strong>{mensaje}</strong>
      </p>
      <button type="button" class="g-btn-ghost" onClick={onQuitar}>
        Quitar filtros
      </button>
    </div>
  );
}
