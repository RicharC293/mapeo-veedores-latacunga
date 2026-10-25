import { useMemo, useRef, useState } from "preact/hooks";
import FiltrosRecintos, { VacioFiltros } from "./FiltrosRecintos";
import Resaltado from "./Resaltado";
import { normalizar, title } from "../../lib/format";
import { coincideUbicacion, type Ubicacion } from "../../lib/gestion/ubicacion";
import {
  ETIQUETA_GENERO,
  edad,
  type EstadoIdentidad,
} from "../../lib/validacion/plan";
import type {
  DatosVerificacion,
  FilaVerificacion,
} from "../../lib/validacion/pantalla";
import type { ResultadoLote } from "../../lib/validacion/validaciones";
import type { ParroquiaBasica, Recinto } from "../../lib/types";

interface Props {
  parroquias: ParroquiaBasica[];
  recintos: Recinto[];
  datosIniciales: DatosVerificacion;
  hayClave: boolean;
}

// "sinconsultar" junta las nunca consultadas y las que dieron error técnico:
// son las que se pueden consultar.
type Filtro =
  | "todos"
  | "sinconsultar"
  | "coincide"
  | "revisar"
  | "verificada"
  | "no_encontrada"
  | "invalida";
type Rol = "todos" | FilaVerificacion["rol"];

const ESTADO: Record<EstadoIdentidad, { etiqueta: string; clase: string }> = {
  sin_consultar: { etiqueta: "Sin consultar", clase: "chip-estado-sin" },
  error: { etiqueta: "Error, reintentar", clase: "chip-estado-pendiente" },
  invalida: { etiqueta: "Cédula inválida", clase: "chip-estado-pendiente" },
  verificada: { etiqueta: "Verificada", clase: "chip-estado-ok" },
  coincide: { etiqueta: "Coincide", clase: "chip-estado-casi" },
  revisar: { etiqueta: "Por revisar", clase: "chip-estado-pendiente" },
  no_encontrada: { etiqueta: "No encontrada", clase: "chip-estado-pendiente" },
};
const ROL: Record<FilaVerificacion["rol"], string> = {
  veedor: "Veedor",
  coordinador: "Coordinador",
  cda: "Acreditado CDA",
};
const POR_TANDA = 10;
const PAGINA = 100;

const consultable = (f: FilaVerificacion) =>
  f.estado === "sin_consultar" || f.estado === "error";

const enFiltro = (f: FilaVerificacion, filtro: Filtro) =>
  filtro === "todos" ||
  (filtro === "sinconsultar" ? consultable(f) : f.estado === filtro);

const dolares = (n: number) =>
  `US$${n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as T;
}

export default function GestionValidacion({
  parroquias,
  recintos,
  datosIniciales,
  hayClave,
}: Props) {
  const [datos, setDatos] = useState(datosIniciales);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("todas");
  const [recintoCod, setRecintoCod] = useState<number | "">("");
  const [rol, setRol] = useState<Rol>("todos");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [consultando, setConsultando] = useState(false);
  const [progreso, setProgreso] = useState<{
    hechas: number;
    total: number;
  } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(PAGINA);
  const detenerRef = useRef(false);
  const hoy = useMemo(() => new Date(), []);

  const parroquiaDe = useMemo(
    () => new Map(parroquias.map((p) => [p.properties.code, p])),
    [parroquias],
  );
  const recintoDe = useMemo(
    () => new Map(recintos.map((r) => [r.cod, r])),
    [recintos],
  );
  const recintosOpciones = useMemo(
    () =>
      typeof ubicacion === "number"
        ? recintos
            .filter((r) => r.par === ubicacion)
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        : [],
    [recintos, ubicacion],
  );

  // Filas tras ubicación, recinto, rol y búsqueda (los conteos de estado
  // salen de aquí).
  const base = useMemo(() => {
    const q = normalizar(busqueda);
    return datos.filas.filter((f) => {
      if (!coincideUbicacion(ubicacion, parroquiaDe.get(f.parroquiaCodigo)))
        return false;
      if (recintoCod !== "" && f.recintoCodigo !== recintoCod) return false;
      if (rol !== "todos" && f.rol !== rol) return false;
      if (
        q &&
        !normalizar(`${f.nombres} ${f.cedula} ${f.oficial ?? ""}`).includes(q)
      )
        return false;
      return true;
    });
  }, [datos.filas, ubicacion, recintoCod, rol, busqueda, parroquiaDe]);

  const conteo = (fl: Filtro) => base.filter((f) => enFiltro(f, fl)).length;
  const filas = useMemo(
    () =>
      base
        .filter((f) => enFiltro(f, filtro))
        .sort(
          (a, b) =>
            (recintoDe.get(a.recintoCodigo)?.nombre ?? "").localeCompare(
              recintoDe.get(b.recintoCodigo)?.nombre ?? "",
            ) || a.nombres.localeCompare(b.nombres),
        ),
    [base, filtro, recintoDe],
  );

  const consultablesDelFiltro = filas.filter(consultable).map((f) => f.cedula);
  const coincidenDelFiltro = filas
    .filter((f) => f.estado === "coincide")
    .map((f) => f.cedula);
  const costo = seleccion.size * datos.costoPorConsulta;

  const refrescar = async () => {
    setDatos(await api<DatosVerificacion>("/api/gestion/validacion"));
  };

  const alternar = (cedula: string) =>
    setSeleccion((prev) => {
      const s = new Set(prev);
      if (s.has(cedula)) s.delete(cedula);
      else s.add(cedula);
      return s;
    });

  const consultar = async () => {
    setConfirmando(false);
    setConsultando(true);
    setError(null);
    setAviso(null);
    detenerRef.current = false;
    const lista = [...seleccion];
    const total = {
      consultadas: 0,
      validadas: 0,
      noEncontradas: 0,
      conError: 0,
    };
    let detenido: string | null = null;
    setProgreso({ hechas: 0, total: lista.length });
    try {
      for (let i = 0; i < lista.length && !detenerRef.current; i += POR_TANDA) {
        const tanda = lista.slice(i, i + POR_TANDA);
        const r = await api<ResultadoLote>(
          "/api/gestion/validacion/consultar",
          {
            method: "POST",
            body: JSON.stringify({ cedulas: tanda }),
          },
        );
        total.consultadas += r.consultadas;
        total.validadas += r.validadas;
        total.noEncontradas += r.noEncontradas;
        total.conError += r.conError;
        setProgreso({
          hechas: Math.min(i + tanda.length, lista.length),
          total: lista.length,
        });
        if (r.detenido) {
          detenido = r.detenido;
          break;
        }
      }
      setAviso(
        `${detenido ? `Se detuvo: ${detenido} ` : detenerRef.current ? "Consulta detenida. " : ""}Consultadas ${total.consultadas}: ${total.validadas} con datos, ${total.noEncontradas} no encontradas, ${total.conError} con error.`,
      );
      setSeleccion(new Set());
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setConsultando(false);
      setProgreso(null);
    }
  };

  const decidir = async (accion: "aplicar" | "mantener", cedulas: string[]) => {
    if (cedulas.length === 0) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await api<{ aplicadas?: number; mantenidas?: number }>(
        `/api/gestion/validacion/${accion}`,
        { method: "POST", body: JSON.stringify({ cedulas }) },
      );
      const n = r.aplicadas ?? r.mantenidas ?? 0;
      setAviso(
        accion === "aplicar"
          ? `Nombre oficial aplicado a ${n} ${n === 1 ? "persona" : "personas"}.`
          : `Se mantuvo el nombre del sistema de ${n} ${n === 1 ? "persona" : "personas"}.`,
      );
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  const quitarFiltros = () => {
    setUbicacion("todas");
    setRecintoCod("");
    setRol("todos");
    setFiltro("todos");
    setBusqueda("");
  };
  const hayFiltros =
    ubicacion !== "todas" ||
    recintoCod !== "" ||
    rol !== "todos" ||
    filtro !== "todos" ||
    busqueda !== "";

  return (
    <div class="g-panel g-val">
      <FiltrosRecintos
        parroquias={parroquias}
        ubicacion={ubicacion}
        onUbicacion={(u) => {
          setUbicacion(u);
          setRecintoCod("");
          setVisibles(PAGINA);
        }}
        estados={[
          { clave: "todos", etiqueta: "Todos", n: base.length },
          {
            clave: "sinconsultar",
            etiqueta: "Sin consultar",
            n: conteo("sinconsultar"),
          },
          {
            clave: "coincide",
            etiqueta: "Coinciden",
            n: conteo("coincide"),
            aviso: true,
          },
          {
            clave: "revisar",
            etiqueta: "Por revisar",
            n: conteo("revisar"),
            alerta: true,
          },
          {
            clave: "verificada",
            etiqueta: "Verificadas",
            n: conteo("verificada"),
          },
          {
            clave: "no_encontrada",
            etiqueta: "No encontradas",
            n: conteo("no_encontrada"),
            alerta: true,
          },
          {
            clave: "invalida",
            etiqueta: "Cédula inválida",
            n: conteo("invalida"),
            alerta: true,
          },
        ]}
        estado={filtro}
        onEstado={(f) => {
          setFiltro(f);
          setVisibles(PAGINA);
        }}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Nombre o cédula…"
        contador={`Mostrando ${Math.min(visibles, filas.length)} de ${filas.length} personas`}
        hayFiltros={hayFiltros}
        onQuitar={quitarFiltros}
      />

      <div class="g-selects g-val-filtros">
        {typeof ubicacion === "number" ? (
          <label>
            Recinto
            <select
              value={recintoCod}
              onChange={(e) =>
                setRecintoCod(
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
                )
              }
            >
              <option value="">Todos los recintos</option>
              {recintosOpciones.map((r) => (
                <option key={r.cod} value={r.cod}>
                  {title(r.nombre)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Responsabilidad
          <select
            value={rol}
            onChange={(e) =>
              setRol((e.currentTarget as HTMLSelectElement).value as Rol)
            }
          >
            <option value="todos">Todas</option>
            <option value="veedor">Veedores</option>
            <option value="coordinador">Coordinadores</option>
            <option value="cda">Acreditados CDA</option>
          </select>
        </label>
      </div>

      <div class="g-val-barra" role="region" aria-label="Acciones">
        {!hayClave ? (
          <p class="g-error">
            Falta configurar la clave ECUADORAPI_KEY en el servidor: no se puede
            consultar.
          </p>
        ) : consultando ? (
          <>
            <span role="status">
              Consultando {progreso?.hechas ?? 0} de {progreso?.total ?? 0}…
            </span>
            <button
              type="button"
              class="g-btn-ghost"
              onClick={() => (detenerRef.current = true)}
            >
              Detener
            </button>
          </>
        ) : confirmando ? (
          <div
            class="g-val-confirmar"
            role="alertdialog"
            aria-label="Confirmar consulta"
          >
            <span>
              Se consultarán <strong>{seleccion.size}</strong> cédulas: hasta{" "}
              <strong>{dolares(costo)}</strong>.
            </span>
            <button type="button" class="g-btn-accion" onClick={consultar}>
              Sí, consultar
            </button>
            <button
              type="button"
              class="g-btn-ghost"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              class="g-btn-accion"
              disabled={seleccion.size === 0}
              onClick={() => setConfirmando(true)}
            >
              Consultar seleccionadas ({seleccion.size} · ≈ {dolares(costo)})
            </button>
            <button
              type="button"
              class="g-btn-ghost"
              disabled={consultablesDelFiltro.length === 0}
              onClick={() => setSeleccion(new Set(consultablesDelFiltro))}
            >
              Seleccionar las {consultablesDelFiltro.length} por consultar del
              filtro
            </button>
            {seleccion.size > 0 ? (
              <button
                type="button"
                class="g-btn-ghost"
                onClick={() => setSeleccion(new Set())}
              >
                Quitar selección
              </button>
            ) : null}
            {coincidenDelFiltro.length > 0 ? (
              <button
                type="button"
                class="g-btn-ghost"
                disabled={ocupado}
                onClick={() => decidir("aplicar", coincidenDelFiltro)}
              >
                Aplicar nombre oficial a las {coincidenDelFiltro.length} que
                coinciden
              </button>
            ) : null}
          </>
        )}
      </div>
      {aviso ? (
        <p role="status" class="g-val-aviso">
          {aviso}
        </p>
      ) : null}
      {error ? <p class="g-error">{error}</p> : null}

      {filas.length === 0 ? (
        <VacioFiltros
          mensaje="Nadie coincide con estos filtros."
          onQuitar={quitarFiltros}
        />
      ) : (
        <>
          <div class="g-table-scroll">
            <table class="g-table g-val-tabla">
              <caption class="g-sr-only">
                Personas del Consolidado y su verificación
              </caption>
              <thead>
                <tr>
                  <th>
                    <span class="g-sr-only">Seleccionar</span>
                  </th>
                  <th>Persona</th>
                  <th>Responsabilidad</th>
                  <th>Estado</th>
                  <th class="g-num">Edad</th>
                  <th>Género</th>
                  <th>
                    <span class="g-sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.slice(0, visibles).map((f) => {
                  const recinto = recintoDe.get(f.recintoCodigo);
                  const e = edad(f.fechaNacimiento, hoy);
                  return (
                    <tr key={f.id}>
                      <td>
                        {consultable(f) ? (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar a ${f.nombres}`}
                            checked={seleccion.has(f.cedula)}
                            disabled={consultando}
                            onChange={() => alternar(f.cedula)}
                          />
                        ) : null}
                      </td>
                      <td>
                        <span class="g-val-nombre">
                          <Resaltado texto={f.nombres} consulta={busqueda} />
                        </span>
                        <small class="g-val-cedula">
                          CI <Resaltado texto={f.cedula} consulta={busqueda} />
                        </small>
                        {f.oficial && f.estado !== "verificada" ? (
                          <small class="g-val-oficial">
                            Oficial: {f.oficial}
                          </small>
                        ) : null}
                        {f.error &&
                        (f.estado === "no_encontrada" ||
                          f.estado === "error") ? (
                          <small class="g-val-oficial">{f.error}</small>
                        ) : null}
                        {f.respuesta ? (
                          <details class="g-val-json">
                            <summary>Ver respuesta</summary>
                            <pre>{JSON.stringify(f.respuesta, null, 2)}</pre>
                          </details>
                        ) : null}
                      </td>
                      <td>
                        {ROL[f.rol]} {f.tipo}
                        {f.junta ? ` · ${f.junta}` : ""}
                        <small class="g-val-cedula">
                          {recinto
                            ? title(recinto.nombre)
                            : `Recinto ${f.recintoCodigo}`}
                        </small>
                      </td>
                      <td>
                        <span class={`chip-estado ${ESTADO[f.estado].clase}`}>
                          {ESTADO[f.estado].etiqueta}
                        </span>
                      </td>
                      <td class="g-num">{e ?? "—"}</td>
                      <td>{f.genero ? ETIQUETA_GENERO[f.genero] : "—"}</td>
                      <td>
                        {f.estado === "coincide" || f.estado === "revisar" ? (
                          <span class="g-val-decision">
                            <button
                              type="button"
                              class="g-btn-ghost"
                              disabled={ocupado}
                              onClick={() => decidir("aplicar", [f.cedula])}
                            >
                              Usar oficial
                            </button>
                            <button
                              type="button"
                              class="g-btn-ghost"
                              disabled={ocupado}
                              onClick={() => decidir("mantener", [f.cedula])}
                            >
                              Mantener
                            </button>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filas.length > visibles ? (
            <button
              type="button"
              class="g-btn-ghost g-val-mas"
              onClick={() => setVisibles((v) => v + PAGINA)}
            >
              Mostrar {Math.min(PAGINA, filas.length - visibles)} más
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
