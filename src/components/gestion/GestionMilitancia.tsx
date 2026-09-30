import { useMemo, useState } from "preact/hooks";
import PersonaForm from "./PersonaForm";
import MilitanteRow from "./MilitanteRow";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { Lider, Militante, TipoMilitancia } from "../../lib/gestion/types";
import type { AsignarDestino } from "../../lib/gestion/militancia";
import { title } from "../../lib/format";

interface Props {
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  lideres: Lider[];
  militantesIniciales: Militante[];
}

type TipoParroquiaFiltro = "todas" | "urbanas" | "rurales";
type FiltroDuplicados = "todos" | "duplicados";
type FiltroResponsable = "todos" | "sin" | string;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as T;
}

function parsearFilas(
  texto: string,
): { cedula: string; nombres: string; telefono: string }[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((linea) => {
      const partes = (
        linea.includes("\t") ? linea.split("\t") : linea.split(",")
      ).map((p) => p.trim().replace(/^["']|["']$/g, ""));
      return {
        cedula: partes[0] ?? "",
        nombres: partes[1] ?? "",
        telefono: partes[2] ?? "",
      };
    });
}

export default function GestionMilitancia({
  parroquias,
  recintos,
  lideres,
  militantesIniciales,
}: Props) {
  const [militantes, setMilitantes] = useState(militantesIniciales);
  const [filtroDuplicados, setFiltroDuplicados] =
    useState<FiltroDuplicados>("todos");
  const [filtroResponsable, setFiltroResponsable] =
    useState<FiltroResponsable>("todos");
  const [formKey, setFormKey] = useState(0);

  // Importación masiva
  const [respImportacion, setRespImportacion] = useState("");
  const [tipoParroquiaImport, setTipoParroquiaImport] =
    useState<TipoParroquiaFiltro>("todas");
  const [parroquiaImport, setParroquiaImport] = useState<number | "">("");
  const [tipoImport, setTipoImport] = useState<TipoMilitancia | "">("");
  const [recintoImport, setRecintoImport] = useState<number | "">("");
  const [textoImport, setTextoImport] = useState("");
  const [enviandoImport, setEnviandoImport] = useState(false);
  const [errorImport, setErrorImport] = useState<string | null>(null);
  const [resultadoImport, setResultadoImport] = useState<{
    creados: number;
    omitidos: number;
  } | null>(null);

  const lideresOrdenados = useMemo(
    () => lideres.slice().sort((a, b) => a.nombres.localeCompare(b.nombres)),
    [lideres],
  );

  const parroquiasImportFiltradas = useMemo(
    () =>
      parroquias
        .filter((p) =>
          tipoParroquiaImport === "todas"
            ? true
            : p.properties.urbana === (tipoParroquiaImport === "urbanas"),
        )
        .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
    [parroquias, tipoParroquiaImport],
  );

  const recintosImportFiltrados = useMemo(
    () =>
      recintos
        .filter((r) => r.par === parroquiaImport)
        .filter((r) => tipoImport !== "cda" || r.cda)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [recintos, parroquiaImport, tipoImport],
  );

  const refrescar = async () => {
    setMilitantes(await api<Militante[]>("/api/gestion/militancia"));
  };

  const filtrados = useMemo(
    () =>
      militantes.filter((m) => {
        if (filtroDuplicados === "duplicados" && !m.duplicado) return false;
        if (filtroResponsable === "sin" && m.responsableLiderId) return false;
        if (
          filtroResponsable !== "todos" &&
          filtroResponsable !== "sin" &&
          m.responsableLiderId !== filtroResponsable
        )
          return false;
        return true;
      }),
    [militantes, filtroDuplicados, filtroResponsable],
  );

  const importar = async (e: Event) => {
    e.preventDefault();
    if (!respImportacion) return;
    setErrorImport(null);
    setResultadoImport(null);
    setEnviandoImport(true);
    try {
      const filas = parsearFilas(textoImport);
      const resultado = await api<{ creados: number; omitidos: number }>(
        "/api/gestion/militancia/importar",
        {
          method: "POST",
          body: JSON.stringify({
            responsableLiderId: respImportacion,
            recintoCodigo: recintoImport || undefined,
            tipoPreasignado: tipoImport || undefined,
            filas,
          }),
        },
      );
      setResultadoImport(resultado);
      setTextoImport("");
      await refrescar();
    } catch (err) {
      setErrorImport(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviandoImport(false);
    }
  };

  return (
    <div class="g-panel">
      <form class="g-form" onSubmit={importar}>
        <p class="g-form-title">Importación masiva</p>
        <label>
          Responsable
          <select
            value={respImportacion}
            required
            onChange={(e) =>
              setRespImportacion((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="">Selecciona…</option>
            {lideresOrdenados.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombres}
              </option>
            ))}
          </select>
        </label>
        <p class="g-sub" style={{ margin: "4px 0" }}>
          Opcional: preasigna Recinto y Tipo a todo el lote (se puede ajustar
          después, fila por fila).
        </p>
        <div class="g-selects">
          <label>
            Tipo de parroquia
            <select
              value={tipoParroquiaImport}
              onChange={(e) => {
                setTipoParroquiaImport(
                  (e.currentTarget as HTMLSelectElement)
                    .value as TipoParroquiaFiltro,
                );
                setParroquiaImport("");
                setRecintoImport("");
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
              value={parroquiaImport}
              onChange={(e) => {
                setParroquiaImport(
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
                );
                setRecintoImport("");
              }}
            >
              <option value="">Sin preasignar</option>
              {parroquiasImportFiltradas.map((p) => (
                <option key={p.properties.code} value={p.properties.code}>
                  {p.properties.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select
              value={tipoImport}
              onChange={(e) => {
                setTipoImport(
                  (e.currentTarget as HTMLSelectElement).value as
                    | TipoMilitancia
                    | "",
                );
                setRecintoImport("");
              }}
            >
              <option value="">Sin preasignar</option>
              <option value="veedor">Veedor</option>
              <option value="coordinador">Coordinador</option>
              <option value="cda">Acreditado CDA</option>
            </select>
          </label>
          <label>
            Recinto
            <select
              value={recintoImport}
              disabled={!parroquiaImport}
              onChange={(e) =>
                setRecintoImport(
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
                )
              }
            >
              <option value="">Sin preasignar</option>
              {recintosImportFiltrados.map((r) => (
                <option key={r.cod} value={r.cod}>
                  {title(r.nombre)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Personas (una por línea: cédula, nombres y apellidos, celular)
          <textarea
            value={textoImport}
            rows={6}
            placeholder={"0501234567\tJuan Pérez\t0991234567"}
            onInput={(e) =>
              setTextoImport((e.currentTarget as HTMLTextAreaElement).value)
            }
          />
        </label>
        {errorImport ? <p class="g-error">{errorImport}</p> : null}
        {resultadoImport ? (
          <p class="g-empty">
            {resultadoImport.creados} importados
            {resultadoImport.omitidos > 0
              ? `, ${resultadoImport.omitidos} omitidos por datos incompletos`
              : ""}
            .
          </p>
        ) : null}
        <div class="g-form-actions">
          <button
            type="submit"
            disabled={
              enviandoImport || !respImportacion || !textoImport.trim()
            }
          >
            {enviandoImport ? "Importando…" : "Importar"}
          </button>
        </div>
      </form>

      <PersonaForm
        key={formKey}
        etiqueta="Agregar militante"
        lideres={lideres}
        onSubmit={async (input) => {
          await api("/api/gestion/militancia", {
            method: "POST",
            body: JSON.stringify(input),
          });
          setFormKey((k) => k + 1);
          await refrescar();
        }}
        onCancel={() => setFormKey((k) => k + 1)}
      />

      <div class="g-selects">
        <label>
          Duplicados
          <select
            value={filtroDuplicados}
            onChange={(e) =>
              setFiltroDuplicados(
                (e.currentTarget as HTMLSelectElement).value as FiltroDuplicados,
              )
            }
          >
            <option value="todos">Todos</option>
            <option value="duplicados">Solo duplicados</option>
          </select>
        </label>
        <label>
          Responsable
          <select
            value={filtroResponsable}
            onChange={(e) =>
              setFiltroResponsable((e.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="todos">Todos</option>
            <option value="sin">Sin responsable</option>
            {lideresOrdenados.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombres}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtrados.length === 0 ? (
        <p class="g-empty">No hay militantes para este filtro.</p>
      ) : (
        <div class="g-table-scroll">
          <table class="g-table">
            <thead>
              <tr>
                <th>Cédula</th>
                <th>Nombres</th>
                <th>Celular</th>
                <th>Responsable</th>
                <th>Tipo de parroquia</th>
                <th>Parroquia</th>
                <th>Tipo</th>
                <th>Recinto</th>
                <th>Junta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((m) => (
                <MilitanteRow
                  key={m.id}
                  militante={m}
                  parroquias={parroquias}
                  recintos={recintos}
                  lideres={lideres}
                  onAsignar={async (destino: AsignarDestino) => {
                    await api(`/api/gestion/militancia/${m.id}/asignar`, {
                      method: "POST",
                      body: JSON.stringify(destino),
                    });
                    await refrescar();
                  }}
                  onEliminar={async () => {
                    await api(`/api/gestion/militancia/${m.id}`, {
                      method: "DELETE",
                    });
                    await refrescar();
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
