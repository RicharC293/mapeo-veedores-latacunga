import { useMemo, useRef, useState } from "preact/hooks";
import FiltrosRecintos, { VacioFiltros } from "./FiltrosRecintos";
import GrupoParroquia from "./GrupoParroquia";
import Iniciales from "./Iniciales";
import { useRecintosAbiertos } from "./useRecintosAbiertos";
import Resaltado from "./Resaltado";
import { normalizar, title } from "../../lib/format";
import {
  agruparPorParroquia,
  coincideUbicacion,
  type Ubicacion,
} from "../../lib/gestion/ubicacion";
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
const POR_TANDA = 10;
// Con pocos recintos a la vista, su detalle se muestra abierto.
const ABRIR_SI_HAY_HASTA = 2;
// Orden de las personas dentro del recinto, como en el Consolidado.
const ORDEN_ROL = { coordinador: 0, cda: 1, veedor: 2 } as const;

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
    () => base.filter((f) => enFiltro(f, filtro)),
    [base, filtro],
  );

  // Como en el Consolidado: parroquia, recinto y, dentro, coordinador, CDA y
  // veedores por junta.
  const grupos = useMemo(() => {
    const porRecinto = new Map<number, FilaVerificacion[]>();
    for (const f of filas) {
      porRecinto.set(f.recintoCodigo, [
        ...(porRecinto.get(f.recintoCodigo) ?? []),
        f,
      ]);
    }
    const items = [...porRecinto.entries()]
      .map(([cod, personas]) => ({
        recinto: recintoDe.get(cod),
        personas: personas.sort(
          (a, b) =>
            ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] ||
            (a.junta ?? "").localeCompare(b.junta ?? "", "es", {
              numeric: true,
            }) ||
            (a.tipo === b.tipo ? 0 : a.tipo === "titular" ? -1 : 1),
        ),
      }))
      .filter((i): i is { recinto: Recinto; personas: FilaVerificacion[] } =>
        Boolean(i.recinto),
      );
    return agruparPorParroquia(items, parroquias);
  }, [filas, recintoDe, parroquias]);
  const totalRecintos = grupos.reduce((a, g) => a + g.items.length, 0);
  const { estaAbierto, alternar: alternarRecinto } = useRecintosAbiertos(
    totalRecintos <= ABRIR_SI_HAY_HASTA,
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

  const decidir = async (
    accion: "aplicar" | "mantener" | "deshacer",
    cedulas: string[],
  ) => {
    if (cedulas.length === 0) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await api<{
        aplicadas?: number;
        mantenidas?: number;
        deshechas?: number;
      }>(`/api/gestion/validacion/${accion}`, {
        method: "POST",
        body: JSON.stringify({ cedulas }),
      });
      const n = r.aplicadas ?? r.mantenidas ?? r.deshechas ?? 0;
      const personas = `${n} ${n === 1 ? "persona" : "personas"}`;
      setAviso(
        accion === "aplicar"
          ? `Nombre oficial aplicado a ${personas}.`
          : accion === "mantener"
            ? `Se mantuvo el nombre del sistema de ${personas}.`
            : `Se devolvió el nombre anterior a ${personas}.`,
      );
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  // Una persona: casilla para consultarla, iniciales, nombre, estado, edad,
  // género y las decisiones sobre su nombre.
  const persona = (f: FilaVerificacion) => {
    const e = edad(f.fechaNacimiento, hoy);
    const personales = [
      e !== null ? `${e} años` : null,
      f.genero ? ETIQUETA_GENERO[f.genero] : null,
    ].filter(Boolean);
    return (
      <div class="g-consol-persona g-val-persona">
        {consultable(f) ? (
          <input
            type="checkbox"
            class="g-val-check"
            aria-label={`Seleccionar a ${f.nombres} para consultar`}
            checked={seleccion.has(f.cedula)}
            disabled={consultando || !hayClave}
            onChange={() => alternar(f.cedula)}
          />
        ) : null}
        <Iniciales nombres={f.nombres} rol={f.tipo} />
        <div class="g-consol-persona-texto">
          <strong>
            <Resaltado texto={f.nombres} consulta={busqueda} />
          </strong>
          <small>
            CI <Resaltado texto={f.cedula} consulta={busqueda} />
            {f.tipo === "suplente" ? " · Suplente" : ""}
          </small>
          <span class="g-val-linea">
            <span class={`chip-estado ${ESTADO[f.estado].clase}`}>
              {ESTADO[f.estado].etiqueta}
            </span>
            {personales.length > 0 ? (
              <small>{personales.join(" · ")}</small>
            ) : null}
          </span>
          {f.oficial && f.estado !== "verificada" ? (
            <small class="g-val-oficial">Oficial: {f.oficial}</small>
          ) : null}
          {f.nombreAnterior ? (
            <small class="g-val-oficial">Antes: {f.nombreAnterior}</small>
          ) : null}
          {f.error && (f.estado === "no_encontrada" || f.estado === "error") ? (
            <small class="g-val-oficial">{f.error}</small>
          ) : null}
          {f.respuesta ? (
            <details class="g-val-json">
              <summary>Ver respuesta</summary>
              <pre>{JSON.stringify(f.respuesta, null, 2)}</pre>
            </details>
          ) : null}
        </div>
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
        ) : f.nombreAnterior ? (
          <span class="g-val-decision">
            <button
              type="button"
              class="g-btn-ghost"
              disabled={ocupado}
              onClick={() => decidir("deshacer", [f.cedula])}
            >
              Deshacer
            </button>
          </span>
        ) : null}
      </div>
    );
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
        onEstado={setFiltro}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Nombre o cédula…"
        contador={`${filas.length} ${filas.length === 1 ? "persona" : "personas"} en ${totalRecintos} ${totalRecintos === 1 ? "recinto" : "recintos"}`}
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
              {consultablesDelFiltro.length === 1
                ? "Seleccionar la que falta consultar del filtro"
                : `Seleccionar las ${consultablesDelFiltro.length} por consultar del filtro`}
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

      {grupos.length === 0 ? (
        <VacioFiltros
          mensaje="Nadie coincide con estos filtros."
          onQuitar={quitarFiltros}
        />
      ) : (
        grupos.map((g) => {
          const delGrupo = g.items.flatMap((i) => i.personas);
          const verificadas = delGrupo.filter(
            (f) => f.estado === "verificada",
          ).length;
          return (
            <GrupoParroquia
              key={g.parroquia?.properties.code ?? "sin-parroquia"}
              parroquia={g.parroquia}
              cuenta={`${verificadas} de ${delGrupo.length} verificadas`}
            >
              <div class="g-grupo-cuerpo">
                {g.items.map(({ recinto, personas }) => {
                  const abierto = estaAbierto(recinto.cod);
                  const ver = personas.filter(
                    (f) => f.estado === "verificada",
                  ).length;
                  const revisar = personas.filter(
                    (f) => f.estado === "revisar" || f.estado === "coincide",
                  ).length;
                  const porConsultar = personas.filter(consultable);
                  const problemas = personas.filter(
                    (f) =>
                      f.estado === "no_encontrada" || f.estado === "invalida",
                  ).length;
                  const secciones = [
                    {
                      titulo: "Coordinador",
                      lista: personas.filter((f) => f.rol === "coordinador"),
                    },
                    {
                      titulo: "Acreditado CDA",
                      lista: personas.filter((f) => f.rol === "cda"),
                    },
                    {
                      titulo: "Veedores por junta",
                      lista: personas.filter((f) => f.rol === "veedor"),
                    },
                  ].filter((sec) => sec.lista.length > 0);
                  return (
                    <details
                      class="g-recinto"
                      key={recinto.cod}
                      open={abierto}
                      onToggle={(e) =>
                        alternarRecinto(
                          recinto.cod,
                          (e.currentTarget as HTMLDetailsElement).open,
                        )
                      }
                    >
                      <summary>
                        <span class="g-grupo-nombre">
                          {title(recinto.nombre)}
                        </span>
                        <span class="g-consol-estados">
                          <span
                            class={`chip-estado ${ver === personas.length ? "chip-estado-ok" : "chip-estado-sin"}`}
                          >
                            Verificadas {ver}/{personas.length}
                          </span>
                          {revisar > 0 ? (
                            <span class="chip-estado chip-estado-casi">
                              Por revisar {revisar}
                            </span>
                          ) : null}
                          {porConsultar.length > 0 ? (
                            <span class="chip-estado chip-estado-sin">
                              Sin consultar {porConsultar.length}
                            </span>
                          ) : null}
                          {problemas > 0 ? (
                            <span class="chip-estado chip-estado-pendiente">
                              Con problema {problemas}
                            </span>
                          ) : null}
                        </span>
                      </summary>
                      {abierto ? (
                        <div class="g-consol-detalle">
                          {secciones.map((sec, i) => (
                            <section key={sec.titulo}>
                              <h4>
                                {sec.titulo}
                                {i === 0 &&
                                porConsultar.length > 0 &&
                                hayClave &&
                                !consultando ? (
                                  <button
                                    type="button"
                                    class="g-btn-link"
                                    onClick={() =>
                                      setSeleccion(
                                        (prev) =>
                                          new Set([
                                            ...prev,
                                            ...porConsultar.map(
                                              (f) => f.cedula,
                                            ),
                                          ]),
                                      )
                                    }
                                  >
                                    {porConsultar.length === 1
                                      ? "Seleccionar la que falta consultar"
                                      : `Seleccionar las ${porConsultar.length} por consultar del recinto`}
                                  </button>
                                ) : null}
                              </h4>
                              {sec.titulo === "Veedores por junta" ? (
                                <ul class="g-consol-juntas">
                                  {sec.lista.map((f) => (
                                    <li key={f.id}>
                                      <span class="g-consol-junta">
                                        {f.junta}
                                      </span>
                                      <div class="g-consol-junta-cuerpo">
                                        {persona(f)}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                sec.lista.map((f) => (
                                  <div key={f.id}>{persona(f)}</div>
                                ))
                              )}
                            </section>
                          ))}
                        </div>
                      ) : null}
                    </details>
                  );
                })}
              </div>
            </GrupoParroquia>
          );
        })
      )}
    </div>
  );
}
