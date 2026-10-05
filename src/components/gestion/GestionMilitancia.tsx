import { useMemo, useRef, useState } from "preact/hooks";
import * as XLSX from "xlsx";
import PersonaForm from "./PersonaForm";
import MilitanteCard from "./MilitanteCard";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { Lider, Militante, TipoMilitancia } from "../../lib/gestion/types";
import type { AsignarDestino } from "../../lib/gestion/militancia";
import { normalizar, title } from "../../lib/format";

interface Props {
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  lideres: Lider[];
  militantesIniciales: Militante[];
}

type TipoParroquiaFiltro = "todas" | "urbanas" | "rurales";
type Vista = "todos" | "incorrectos" | "duplicados" | "sinrecinto";
type Panel = null | "importar" | "agregar";
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
  preferencia: string;
}

function parsearFilas(texto: string): FilaImport[] {
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
        preferencia: partes[4] ?? "",
      };
    });
}

const PLANTILLA_ENCABEZADOS = [
  "Nombres y apellidos",
  "Cédula",
  "Celular",
  "Correo electrónico",
  "Recinto de preferencia",
];

function descargarPlantilla() {
  const hoja = XLSX.utils.aoa_to_sheet([PLANTILLA_ENCABEZADOS]);
  hoja["!cols"] = [
    { wch: 32 },
    { wch: 14 },
    { wch: 14 },
    { wch: 30 },
    { wch: 36 },
  ];
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

async function leerArchivoPlantilla(file: File): Promise<FilaImport[]> {
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
      preferencia: valorPara(fila, ["preferencia", "recinto"]),
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
  const [vista, setVista] = useState<Vista>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [filtroResponsable, setFiltroResponsable] =
    useState<FiltroResponsable>("todos");
  // Con la bandeja vacía lo primero que hace falta es cargar gente.
  const [panel, setPanel] = useState<Panel>(
    militantesIniciales.length === 0 ? "importar" : null,
  );
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
    incorrectos: number;
    precargados: number;
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

  const conteos = useMemo(
    () => ({
      todos: militantes.length,
      incorrectos: militantes.filter((m) => m.incorrecto).length,
      duplicados: militantes.filter((m) => m.duplicado).length,
      sinrecinto: militantes.filter((m) => m.recintoCodigo === null).length,
    }),
    [militantes],
  );

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return militantes.filter((m) => {
      if (vista === "incorrectos" && !m.incorrecto) return false;
      if (vista === "duplicados" && !m.duplicado) return false;
      if (vista === "sinrecinto" && m.recintoCodigo !== null) return false;
      if (filtroResponsable === "sin" && m.responsableLiderId) return false;
      if (
        filtroResponsable !== "todos" &&
        filtroResponsable !== "sin" &&
        m.responsableLiderId !== filtroResponsable
      )
        return false;
      if (q) {
        const texto = normalizar(
          `${m.nombres} ${m.cedula} ${m.telefono} ${m.email} ${m.preferencia}`,
        );
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [militantes, vista, busqueda, filtroResponsable]);

  const hayFiltros =
    vista !== "todos" || busqueda !== "" || filtroResponsable !== "todos";
  const limpiarFiltros = () => {
    setVista("todos");
    setBusqueda("");
    setFiltroResponsable("todos");
  };

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
            (f) =>
              `${f.cedula}\t${f.nombres}\t${f.telefono}\t${f.email}\t${f.preferencia}`,
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
        incorrectos: number;
        precargados: number;
      }>("/api/gestion/militancia/importar", {
        method: "POST",
        body: JSON.stringify({
          responsableLiderId: respImportacion,
          recintoCodigo: recintoImport || undefined,
          tipoPreasignado: tipoImport || undefined,
          filas,
        }),
      });
      setResultadoImport(resultado);
      setTextoImport("");
      await refrescar();
    } catch (err) {
      setErrorImport(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviandoImport(false);
    }
  };

  const chips: { clave: Vista; etiqueta: string }[] = [
    { clave: "todos", etiqueta: "Todos" },
    { clave: "incorrectos", etiqueta: "Incorrectos" },
    { clave: "duplicados", etiqueta: "Duplicados" },
    { clave: "sinrecinto", etiqueta: "Sin recinto" },
  ];

  const alternarPanel = (cual: Exclude<Panel, null>) =>
    setPanel(panel === cual ? null : cual);

  return (
    <div class="g-panel g-mil">
      <div class="g-mil-barra">
        <div class="g-mil-barra-acciones">
          <button
            type="button"
            class={panel === "importar" ? "g-btn-accion" : "g-btn-ghost"}
            aria-expanded={panel === "importar"}
            onClick={() => alternarPanel("importar")}
          >
            Importar lista
          </button>
          <button
            type="button"
            class={panel === "agregar" ? "g-btn-accion" : "g-btn-ghost"}
            aria-expanded={panel === "agregar"}
            onClick={() => alternarPanel("agregar")}
          >
            Agregar persona
          </button>
        </div>
      </div>

      {panel === "importar" ? (
        <form class="g-form g-mil-panel" onSubmit={importar}>
          <p class="g-form-title">Importar lista</p>
          <label>
            Responsable de todo el lote
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
          <fieldset class="g-mil-destino">
            <legend>Destino para todo el lote (opcional)</legend>
            <p class="g-sub">
              Si lo dejas vacío, cada fila toma su recinto de la columna
              Preferencia cuando se reconoce un único recinto. Lo que elijas
              aquí tiene prioridad sobre eso.
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
                      Number((e.currentTarget as HTMLSelectElement).value) ||
                        "",
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
                        TipoMilitancia | "",
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
                      Number((e.currentTarget as HTMLSelectElement).value) ||
                        "",
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
          </fieldset>
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
            Personas, una por línea: cédula, nombres y apellidos, celular,
            correo, recinto de preferencia
            <textarea
              value={textoImport}
              rows={6}
              placeholder={
                "0501234567\tJuan Pérez\t0991234567\tjuan@correo.com\tColegio La Salle"
              }
              onInput={(e) =>
                setTextoImport((e.currentTarget as HTMLTextAreaElement).value)
              }
            />
          </label>
          {errorImport ? <p class="g-error">{errorImport}</p> : null}
          {resultadoImport ? (
            <p class="g-mil-resultado" role="status">
              {resultadoImport.creados} importados
              {resultadoImport.precargados > 0
                ? `, ${resultadoImport.precargados} con recinto precargado`
                : ""}
              {resultadoImport.incorrectos > 0
                ? `, ${resultadoImport.incorrectos} con datos incorrectos`
                : ""}
              {resultadoImport.omitidos > 0
                ? `, ${resultadoImport.omitidos} omitidos por venir vacíos`
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
            <button
              type="button"
              class="g-btn-ghost"
              onClick={() => setPanel(null)}
            >
              Cerrar
            </button>
          </div>
        </form>
      ) : null}

      {panel === "agregar" ? (
        <div class="g-mil-panel">
          <PersonaForm
            key={formKey}
            etiqueta="Agregar persona"
            lideres={lideres}
            conPreferencia
            onSubmit={async (input) => {
              await api("/api/gestion/militancia", {
                method: "POST",
                body: JSON.stringify(input),
              });
              setFormKey((k) => k + 1);
              await refrescar();
            }}
            onCancel={() => setPanel(null)}
          />
        </div>
      ) : null}

      <div class="g-mil-filtros">
        <div class="g-mil-chips" role="group" aria-label="Ver">
          {chips.map((c) => (
            <button
              key={c.clave}
              type="button"
              class="g-chip-filtro"
              aria-pressed={vista === c.clave}
              data-alerta={
                (c.clave === "incorrectos" || c.clave === "duplicados") &&
                conteos[c.clave] > 0
                  ? "true"
                  : undefined
              }
              onClick={() => setVista(c.clave)}
            >
              {c.etiqueta}
              <span class="g-chip-filtro-n">{conteos[c.clave]}</span>
            </button>
          ))}
        </div>
        <div class="g-mil-buscar">
          <label>
            Buscar
            <input
              type="search"
              value={busqueda}
              placeholder="Nombre, cédula, correo, recinto…"
              onInput={(e) =>
                setBusqueda((e.currentTarget as HTMLInputElement).value)
              }
            />
          </label>
          <label>
            Responsable
            <select
              value={filtroResponsable}
              onChange={(e) =>
                setFiltroResponsable(
                  (e.currentTarget as HTMLSelectElement).value,
                )
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
      </div>

      {militantes.length === 0 ? (
        <div class="g-mil-vacio">
          <p>
            <strong>La bandeja está vacía.</strong>
          </p>
          <p class="g-sub">
            Importa una lista (pegada o desde Excel) o agrega una persona. Luego
            asígnala aquí como veedor, coordinador o acreditado CDA.
          </p>
        </div>
      ) : filtrados.length === 0 ? (
        <div class="g-mil-vacio">
          <p>
            <strong>Ninguna persona coincide con estos filtros.</strong>
          </p>
          <button type="button" class="g-btn-ghost" onClick={limpiarFiltros}>
            Quitar filtros
          </button>
        </div>
      ) : (
        <>
          <p class="g-mil-contador" aria-live="polite">
            {hayFiltros
              ? `Mostrando ${filtrados.length} de ${militantes.length}`
              : `${militantes.length} en la bandeja`}
          </p>
          <ul class="g-mil-lista">
            {filtrados.map((m) => (
              <MilitanteCard
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
                onEditar={async (patch) => {
                  await api(`/api/gestion/militancia/${m.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(patch),
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
          </ul>
        </>
      )}
    </div>
  );
}
