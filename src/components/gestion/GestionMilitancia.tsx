import { useMemo, useRef, useState } from "preact/hooks";
import * as XLSX from "xlsx";
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

// Excel guarda una cédula/celular como número si la columna no está en
// formato texto, y de paso le come el cero inicial (0501234567 -> 501234567).
// Las cédulas y celulares ecuatorianos siempre tienen 10 dígitos y a lo
// sumo un cero inicial, así que se puede recuperar con confianza.
function restaurarCeroInicial(valor: string): string {
  return /^\d{9}$/.test(valor) ? `0${valor}` : valor;
}

interface FilaImport {
  cedula: string;
  nombres: string;
  telefono: string;
  email: string;
}

function parsearFilas(
  texto: string,
): FilaImport[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((linea) => {
      const partes = (
        linea.includes("\t") ? linea.split("\t") : linea.split(",")
      ).map((p) => p.trim().replace(/^["']|["']$/g, ""));
      return {
        cedula: restaurarCeroInicial(partes[0] ?? ""),
        nombres: partes[1] ?? "",
        telefono: restaurarCeroInicial(partes[2] ?? ""),
        email: partes[3] ?? "",
      };
    });
}

const PLANTILLA_ENCABEZADOS = [
  "Nombres y apellidos",
  "Cédula",
  "Celular",
  "Correo electrónico",
];

function descargarPlantilla() {
  const hoja = XLSX.utils.aoa_to_sheet([PLANTILLA_ENCABEZADOS]);
  hoja["!cols"] = [{ wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Militancia");
  XLSX.writeFile(libro, "plantilla-militancia.xlsx");
}

function normalizarEncabezado(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");
}

async function leerArchivoPlantilla(
  file: File,
): Promise<FilaImport[]> {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: "array" });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
  });

  const valorPara = (fila: Record<string, unknown>, patrones: string[]) => {
    for (const [clave, valor] of Object.entries(fila)) {
      if (patrones.some((p) => normalizarEncabezado(clave).includes(p))) {
        return String(valor ?? "").trim();
      }
    }
    return "";
  };

  return filas
    .map((fila) => ({
      nombres: valorPara(fila, ["nombre"]),
      cedula: restaurarCeroInicial(valorPara(fila, ["cedula"])),
      telefono: restaurarCeroInicial(
        valorPara(fila, ["celular", "telefono", "movil"]),
      ),
      email: valorPara(fila, ["correo", "email", "mail"]),
    }))
    .filter((f) => f.cedula || f.nombres);
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
    correosIgnorados: number;
  } | null>(null);
  const [archivoMensaje, setArchivoMensaje] = useState<string | null>(null);
  const archivoInputRef = useRef<HTMLInputElement | null>(null);

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

  const cargarArchivo = async (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
    if (archivoInputRef.current) archivoInputRef.current.value = "";
    if (!file) return;
    setArchivoMensaje(null);
    setErrorImport(null);
    try {
      const filas = await leerArchivoPlantilla(file);
      if (filas.length === 0) {
        setArchivoMensaje(
          "No se encontraron filas con Cédula o Nombres en el archivo.",
        );
        return;
      }
      setTextoImport(
        filas
          .map(
            (f) => `${f.cedula}\t${f.nombres}\t${f.telefono}\t${f.email}`,
          )
          .join("\n"),
      );
      setArchivoMensaje(
        `${filas.length} fila(s) cargadas desde el archivo. Revisa el texto antes de importar.`,
      );
    } catch {
      setErrorImport(
        "No se pudo leer el archivo. Verifica que sea un .xlsx o .csv válido.",
      );
    }
  };

  const importar = async (e: Event) => {
    e.preventDefault();
    if (!respImportacion) return;
    setErrorImport(null);
    setResultadoImport(null);
    setEnviandoImport(true);
    try {
      const filas = parsearFilas(textoImport);
      const resultado = await api<{
        creados: number;
        omitidos: number;
        correosIgnorados: number;
      }>(
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
        <div class="g-form-actions">
          <button
            type="button"
            class="g-btn-ghost"
            onClick={descargarPlantilla}
          >
            Descargar plantilla (Excel)
          </button>
          <button
            type="button"
            class="g-btn-ghost"
            onClick={() => archivoInputRef.current?.click()}
          >
            Cargar archivo lleno
          </button>
          <input
            ref={archivoInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            class="g-sr-only"
            onChange={cargarArchivo}
          />
        </div>
        {archivoMensaje ? <p class="g-empty">{archivoMensaje}</p> : null}
        <label>
          Personas (una por línea: cédula, nombres y apellidos, celular, correo)
          <textarea
            value={textoImport}
            rows={6}
            placeholder={"0501234567\tJuan Pérez\t0991234567\tjuan@correo.com"}
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
            {resultadoImport.correosIgnorados > 0
              ? `, ${resultadoImport.correosIgnorados} correo(s) con formato inválido se cargaron vacíos`
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
                <th>Correo</th>
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
