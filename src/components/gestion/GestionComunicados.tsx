import { useMemo, useRef, useState } from "preact/hooks";
import { ResumenAvance, VacioFiltros } from "./FiltrosRecintos";
import BotonIcono, { TrazosIcono } from "./BotonIcono";
import {
  CAMPOS,
  DIGNIDADES,
  FILTROS_INICIALES,
  MENSAJE_INICIAL,
  agruparPorNumero,
  camposVacios,
  coincideFiltros,
  combinarDatos,
  datosDe,
  rellenar,
  type Campo,
  type Comunicado,
  type EnvioComunicado,
  type FiltrosComunicado,
  type PersonaComunicado,
} from "../../lib/comunicados/plan";
import {
  enlaceWhatsapp,
  telefonoWhatsapp,
  textoJunta,
  type Clase,
} from "../../lib/contacto/plan";
import { coincideUbicacion, leerUbicacion } from "../../lib/gestion/ubicacion";
import { normalizar, title } from "../../lib/format";
import type { ParroquiaBasica, Recinto } from "../../lib/types";

interface Props {
  parroquias: ParroquiaBasica[];
  recintos: Recinto[];
  lideres: { id: string; nombres: string }[];
  personas: PersonaComunicado[];
  comunicados: Comunicado[];
  envios: EnvioComunicado[];
  // false si las tablas de comunicados aún no existen (falta la migración).
  tablaLista: boolean;
  // Personas que quedan fuera de todo comunicado y por qué.
  excluidos: { numeroEquivocado: number; listaNegra: number };
}

interface Borrador {
  titulo: string;
  mensaje: string;
  enlace: string;
  filtros: FiltrosComunicado;
}

type Vista = "pendiente" | "enviado" | "todos";

interface Fila {
  numero: string;
  telefono: string;
  personas: PersonaComunicado[];
  mensaje: string;
  vacios: Campo[];
  envio: EnvioComunicado | undefined;
  orden: string;
}

const NUEVO: Borrador = {
  titulo: "",
  mensaje: MENSAJE_INICIAL,
  enlace: "",
  filtros: FILTROS_INICIALES,
};

const borradorDe = (c: Comunicado): Borrador => ({
  titulo: c.titulo,
  mensaje: c.mensaje,
  enlace: c.enlace,
  filtros: c.filtros,
});

const mismo = (a: Borrador, b: Borrador) =>
  JSON.stringify(a) === JSON.stringify(b);

const DIGNIDAD: Record<Clase, string> = {
  coordinador: "Coordinadores",
  cda: "Acreditados CDA",
  veedor: "Veedores",
};
const PUESTO: Record<Clase, string> = {
  coordinador: "Coordinador",
  cda: "Acreditado CDA",
  veedor: "Veedor",
};

const fecha = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  timeZone: "America/Guayaquil",
});
const fechaHora = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

const porNombre = (a: ParroquiaBasica, b: ParroquiaBasica) =>
  a.properties.name.localeCompare(b.properties.name);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as T;
}

function Destinatario({
  f,
  recintoDe,
  bloqueado,
  onEnviado,
  onDeshacer,
}: {
  f: Fila;
  recintoDe: Map<number, Recinto>;
  bloqueado: boolean;
  onEnviado: (f: Fila) => void;
  onDeshacer: (f: Fila) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  // Copiar no cuenta como enviado: sirve para pegarlo a mano.
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(f.mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copia el mensaje:", f.mensaje);
    }
  };
  return (
    <li class="g-contacto">
      <div class="g-com-dest">
        <strong>{f.personas.map((p) => p.nombres).join(" · ")}</strong>
        {f.personas.map((p) => {
          const recinto =
            p.recintoCodigo !== null ? recintoDe.get(p.recintoCodigo) : null;
          return (
            <small key={p.cedula}>
              {f.personas.length > 1 ? `${p.saludo}: ` : ""}
              {p.clase
                ? `${PUESTO[p.clase]} ${p.tipo}`
                : "En Militancia, sin puesto"}
              {p.juntaId ? ` · ${textoJunta(p.juntaId)}` : ""}
              {recinto ? ` · ${title(recinto.nombre)}` : ""}
            </small>
          );
        })}
        <small>
          {f.telefono}
          {f.personas.length > 1
            ? ` · celular compartido por ${f.personas.length} personas`
            : ""}
        </small>
        {f.envio ? (
          <span class="g-contacto-estado">
            <span class="chip-estado chip-estado-ok">Enviado</span>
            <small>
              {fechaHora.format(new Date(f.envio.enviadoEn))}
              {f.envio.enviadoPor ? ` · ${f.envio.enviadoPor}` : ""}
            </small>
          </span>
        ) : null}
        {f.vacios.length > 0 ? (
          <small class="g-contacto-aviso">
            Sin {f.vacios.map((c) => `{${c}}`).join(", ")}: queda en blanco.
          </small>
        ) : null}
      </div>
      <div class="g-contacto-acciones">
        <a
          class="g-btn-icono g-btn-icono-whatsapp"
          href={enlaceWhatsapp(f.numero, f.mensaje)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={f.envio ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
          title={f.envio ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
          aria-disabled={bloqueado ? "true" : undefined}
          onClick={() => onEnviado(f)}
        >
          <TrazosIcono icono="whatsapp" />
        </a>
        <BotonIcono
          icono={copiado ? "check" : "copiar"}
          etiqueta={copiado ? "¡Copiado!" : "Copiar mensaje"}
          onClick={copiar}
        />
        {f.envio ? (
          <BotonIcono
            icono="deshacer"
            etiqueta="Volver a por enviar"
            disabled={bloqueado}
            onClick={() => onDeshacer(f)}
          />
        ) : null}
      </div>
    </li>
  );
}

export default function GestionComunicados({
  parroquias,
  recintos,
  lideres,
  personas,
  comunicados: comunicadosIniciales,
  envios: enviosIniciales,
  tablaLista,
  excluidos,
}: Props) {
  const [comunicados, setComunicados] = useState(comunicadosIniciales);
  const [envios, setEnvios] = useState(enviosIniciales);
  // id del comunicado abierto, "nuevo" mientras se escribe uno, o null.
  const [seleccion, setSeleccion] = useState<string | null>(
    comunicadosIniciales[0]?.id ?? null,
  );
  const [borrador, setBorrador] = useState<Borrador>(
    comunicadosIniciales[0] ? borradorDe(comunicadosIniciales[0]) : NUEVO,
  );
  const [vista, setVista] = useState<Vista>("pendiente");
  const [busqueda, setBusqueda] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const mensajeRef = useRef<HTMLTextAreaElement | null>(null);

  const recintoDe = useMemo(
    () => new Map(recintos.map((r) => [r.cod, r])),
    [recintos],
  );
  const parroquiaDe = useMemo(
    () => new Map(parroquias.map((p) => [p.properties.code, p])),
    [parroquias],
  );
  const parroquiaDePersona = useMemo(
    () => (p: PersonaComunicado) => {
      const r =
        p.recintoCodigo !== null ? recintoDe.get(p.recintoCodigo) : null;
      return r ? parroquiaDe.get(r.par) : undefined;
    },
    [recintoDe, parroquiaDe],
  );
  const urbanas = useMemo(
    () => parroquias.filter((p) => p.properties.urbana).sort(porNombre),
    [parroquias],
  );
  const rurales = useMemo(
    () => parroquias.filter((p) => !p.properties.urbana).sort(porNombre),
    [parroquias],
  );
  const lideresOrdenados = useMemo(
    () => [...lideres].sort((a, b) => a.nombres.localeCompare(b.nombres)),
    [lideres],
  );
  const enMilitancia = personas.filter((p) => p.clase === null).length;

  const actual = comunicados.find((c) => c.id === seleccion);
  const sinGuardar =
    seleccion === "nuevo" ||
    (actual ? !mismo(borrador, borradorDe(actual)) : false);
  const f = borrador.filtros;
  const ponerFiltros = (cambio: Partial<FiltrosComunicado>) =>
    setBorrador((b) => ({ ...b, filtros: { ...b.filtros, ...cambio } }));

  // Números a los que va un juego de filtros.
  const numerosDe = (filtros: FiltrosComunicado) =>
    agruparPorNumero(
      personas.filter((p) =>
        coincideFiltros(p, filtros, parroquiaDePersona(p)),
      ),
      (p) => telefonoWhatsapp(p.telefono),
    );

  const { filas, sinNumero, total } = useMemo(() => {
    const elegidas = personas.filter((p) =>
      coincideFiltros(p, borrador.filtros, parroquiaDePersona(p)),
    );
    const { grupos, sinNumero } = agruparPorNumero(elegidas, (p) =>
      telefonoWhatsapp(p.telefono),
    );
    const envioDe = new Map(
      envios
        .filter((e) => e.comunicadoId === seleccion)
        .map((e) => [e.numero, e]),
    );
    const lista: Fila[] = grupos.map((g) => {
      const datos = combinarDatos(
        g.personas.map((p) => {
          const r =
            p.recintoCodigo !== null
              ? recintoDe.get(p.recintoCodigo)
              : undefined;
          return datosDe(
            p,
            r,
            r ? parroquiaDe.get(r.par) : undefined,
            borrador.enlace,
          );
        }),
      );
      const primera = g.personas[0];
      const r =
        primera.recintoCodigo !== null
          ? recintoDe.get(primera.recintoCodigo)
          : undefined;
      return {
        numero: g.numero,
        telefono: primera.telefono,
        personas: g.personas,
        mensaje: rellenar(borrador.mensaje, datos),
        vacios: camposVacios(borrador.mensaje, datos),
        envio: envioDe.get(g.numero),
        orden: `${r ? (parroquiaDe.get(r.par)?.properties.name ?? "") : "~"}|${r?.nombre ?? ""}|${primera.nombres}`,
      };
    });
    lista.sort((a, b) => a.orden.localeCompare(b.orden, "es"));
    return {
      filas: lista,
      sinNumero,
      total: elegidas.length - sinNumero.length,
    };
  }, [
    personas,
    borrador,
    envios,
    seleccion,
    recintoDe,
    parroquiaDe,
    parroquiaDePersona,
  ]);

  const enviados = filas.filter((x) => x.envio).length;
  const conVacios = filas.filter((x) => x.vacios.length > 0).length;
  const muestra = filas.find((x) => !x.envio) ?? filas[0];
  const q = normalizar(busqueda);
  const visibles = filas.filter(
    (x) =>
      (vista === "todos" ||
        (vista === "enviado" ? Boolean(x.envio) : !x.envio)) &&
      (!q ||
        normalizar(
          `${x.personas.map((p) => `${p.nombres} ${p.cedula}`).join(" ")} ${x.telefono}`,
        ).includes(q)),
  );
  const recintosDeUbicacion = recintos
    .filter((r) => coincideUbicacion(f.ubicacion, parroquiaDe.get(r.par)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const abrir = (id: string | "nuevo") => {
    if (
      sinGuardar &&
      !window.confirm(
        "Hay cambios sin guardar en este comunicado. ¿Descartarlos?",
      )
    ) {
      return;
    }
    const c = comunicados.find((x) => x.id === id);
    setSeleccion(id);
    setBorrador(c ? borradorDe(c) : NUEVO);
    setVista("pendiente");
    setBusqueda("");
    setResultado(null);
  };

  const insertarCampo = (clave: Campo) => {
    const t = mensajeRef.current;
    const marca = `{${clave}}`;
    const inicio = t?.selectionStart ?? borrador.mensaje.length;
    const fin = t?.selectionEnd ?? inicio;
    const mensaje =
      borrador.mensaje.slice(0, inicio) + marca + borrador.mensaje.slice(fin);
    setBorrador((b) => ({ ...b, mensaje }));
    requestAnimationFrame(() => {
      t?.focus();
      t?.setSelectionRange(inicio + marca.length, inicio + marca.length);
    });
  };

  const guardar = async (e: Event) => {
    e.preventDefault();
    setOcupado(true);
    setResultado(null);
    try {
      if (seleccion === "nuevo" || !actual) {
        const c = await api<Comunicado>("/api/gestion/comunicados", {
          method: "POST",
          body: JSON.stringify(borrador),
        });
        setComunicados((l) => [c, ...l]);
        setSeleccion(c.id);
        setBorrador(borradorDe(c));
      } else {
        const c = await api<Comunicado>(
          `/api/gestion/comunicados/${actual.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(borrador),
          },
        );
        setComunicados((l) => l.map((x) => (x.id === c.id ? c : x)));
        setBorrador(borradorDe(c));
      }
      setResultado("Comunicado guardado.");
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  const duplicar = async () => {
    if (!actual) return;
    setOcupado(true);
    setResultado(null);
    try {
      const c = await api<Comunicado>("/api/gestion/comunicados", {
        method: "POST",
        body: JSON.stringify({
          ...borradorDe(actual),
          titulo: `${actual.titulo} (copia)`,
        }),
      });
      setComunicados((l) => [c, ...l]);
      setSeleccion(c.id);
      setBorrador(borradorDe(c));
      setVista("pendiente");
      setResultado("Copia creada con el mismo mensaje y filtros, sin envíos todavía.");
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async () => {
    if (!actual) return;
    if (
      !window.confirm(
        `¿Eliminar "${actual.titulo}" y su registro de envíos? No se puede deshacer.`,
      )
    ) {
      return;
    }
    setOcupado(true);
    setResultado(null);
    try {
      await api(`/api/gestion/comunicados/${actual.id}`, { method: "DELETE" });
      const resto = comunicados.filter((c) => c.id !== actual.id);
      setComunicados(resto);
      setEnvios((l) => l.filter((x) => x.comunicadoId !== actual.id));
      setSeleccion(resto[0]?.id ?? null);
      setBorrador(resto[0] ? borradorDe(resto[0]) : NUEVO);
      setResultado("Comunicado eliminado.");
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  const marcar = async (x: Fila) => {
    if (!actual || sinGuardar) return;
    setOcupado(true);
    setResultado(null);
    try {
      const e = await api<EnvioComunicado>(
        `/api/gestion/comunicados/${actual.id}/envios`,
        { method: "POST", body: JSON.stringify({ numero: x.numero }) },
      );
      setEnvios((l) => [
        ...l.filter(
          (y) => !(y.comunicadoId === actual.id && y.numero === x.numero),
        ),
        e,
      ]);
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  const desmarcar = async (x: Fila) => {
    if (!actual) return;
    setOcupado(true);
    setResultado(null);
    try {
      await api(`/api/gestion/comunicados/${actual.id}/envios`, {
        method: "DELETE",
        body: JSON.stringify({ numero: x.numero }),
      });
      setEnvios((l) =>
        l.filter(
          (y) => !(y.comunicadoId === actual.id && y.numero === x.numero),
        ),
      );
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  if (!tablaLista) {
    return (
      <div class="g-panel">
        <p class="g-error">
          Falta crear las tablas de comunicados en la base de datos: aplica la
          migración <code>20261111000001_comunicados.sql</code>.
        </p>
      </div>
    );
  }

  const quitados = excluidos.numeroEquivocado + excluidos.listaNegra;

  return (
    <div class="g-panel">
      <section class="g-com-guardados" aria-labelledby="g-com-guardados-titulo">
        <div class="g-com-cabecera">
          <h2 id="g-com-guardados-titulo">Guardados</h2>
          <button
            type="button"
            class="g-btn-accion"
            disabled={seleccion === "nuevo"}
            onClick={() => abrir("nuevo")}
          >
            Nuevo comunicado
          </button>
        </div>
        {comunicados.length === 0 && seleccion !== "nuevo" ? (
          <p class="g-contacto-nota">
            Aún no hay comunicados. Crea el primero con «Nuevo comunicado».
          </p>
        ) : (
          <ul class="g-com-lista">
            {seleccion === "nuevo" ? (
              <li>
                <button type="button" class="g-com-item" aria-current="true">
                  <strong>
                    {borrador.titulo.trim() || "Comunicado nuevo"}
                  </strong>
                  <small>Sin guardar</small>
                </button>
              </li>
            ) : null}
            {comunicados.map((c) => {
              const { grupos } = numerosDe(c.filtros);
              const hechos = new Set(
                envios
                  .filter((e) => e.comunicadoId === c.id)
                  .map((e) => e.numero),
              );
              const listos = grupos.filter((g) => hechos.has(g.numero)).length;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    class="g-com-item"
                    aria-current={c.id === seleccion ? "true" : undefined}
                    onClick={() => abrir(c.id)}
                  >
                    <strong>{c.titulo}</strong>
                    <small>
                      {fecha.format(new Date(c.creadoEn))}
                      {c.creadoPor ? ` · ${c.creadoPor}` : ""}
                    </small>
                    <small>
                      {listos} de {grupos.length} enviados
                    </small>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {seleccion !== null ? (
        <>
          <form class="g-form g-com-editor" onSubmit={guardar}>
            <label>
              Título
              <input
                type="text"
                required
                value={borrador.titulo}
                placeholder="Por ejemplo: Capacitación del sábado 22"
                onInput={(e) =>
                  setBorrador((b) => ({
                    ...b,
                    titulo: (e.currentTarget as HTMLInputElement).value,
                  }))
                }
              />
            </label>
            <div
              class="g-com-campos"
              role="group"
              aria-label="Insertar un dato"
            >
              <span>Insertar:</span>
              {CAMPOS.map((c) => (
                <button
                  key={c.clave}
                  type="button"
                  class="g-chip-filtro"
                  onClick={() => insertarCampo(c.clave)}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
            <label>
              Mensaje
              <textarea
                ref={mensajeRef}
                rows={9}
                value={borrador.mensaje}
                onInput={(e) =>
                  setBorrador((b) => ({
                    ...b,
                    mensaje: (e.currentTarget as HTMLTextAreaElement).value,
                  }))
                }
              />
            </label>
            <label>
              Enlace (opcional, va donde pongas {"{enlace}"})
              <input
                type="url"
                value={borrador.enlace}
                placeholder="https://chat.whatsapp.com/…"
                onInput={(e) =>
                  setBorrador((b) => ({
                    ...b,
                    enlace: (e.currentTarget as HTMLInputElement).value,
                  }))
                }
              />
            </label>

            <fieldset class="g-com-filtros">
              <legend>A quién va</legend>
              <div class="g-com-filtros-fila">
                <label>
                  Parroquia
                  <select
                    value={String(f.ubicacion)}
                    onChange={(e) =>
                      ponerFiltros({
                        ubicacion: leerUbicacion(
                          (e.currentTarget as HTMLSelectElement).value,
                        ),
                        recinto: null,
                      })
                    }
                  >
                    <option value="todas">Todas las parroquias</option>
                    <option value="urbanas">Solo urbanas</option>
                    <option value="rurales">Solo rurales</option>
                    <optgroup label="Urbanas">
                      {urbanas.map((p) => (
                        <option
                          key={p.properties.code}
                          value={p.properties.code}
                        >
                          {p.properties.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Rurales">
                      {rurales.map((p) => (
                        <option
                          key={p.properties.code}
                          value={p.properties.code}
                        >
                          {p.properties.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label>
                  Recinto
                  <select
                    value={f.recinto === null ? "" : String(f.recinto)}
                    onChange={(e) => {
                      const v = (e.currentTarget as HTMLSelectElement).value;
                      ponerFiltros({ recinto: v === "" ? null : Number(v) });
                    }}
                  >
                    <option value="">Todos los recintos</option>
                    {recintosDeUbicacion.map((r) => (
                      <option key={r.cod} value={r.cod}>
                        {title(r.nombre)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Titular o suplente
                  <select
                    value={f.tipo}
                    onChange={(e) =>
                      ponerFiltros({
                        tipo: (e.currentTarget as HTMLSelectElement)
                          .value as FiltrosComunicado["tipo"],
                      })
                    }
                  >
                    <option value="todos">Titulares y suplentes</option>
                    <option value="titular">Solo titulares</option>
                    <option value="suplente">Solo suplentes</option>
                  </select>
                </label>
                <label>
                  Responsable
                  <select
                    value={f.responsable}
                    onChange={(e) =>
                      ponerFiltros({
                        responsable: (e.currentTarget as HTMLSelectElement)
                          .value,
                      })
                    }
                  >
                    <option value="todos">Todos los responsables</option>
                    <option value="sin">Sin responsable</option>
                    {lideresOrdenados.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nombres}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div class="g-com-filtros-fila">
                {DIGNIDADES.map((d) => (
                  <label key={d} class="g-check">
                    <input
                      type="checkbox"
                      checked={f.dignidades.includes(d)}
                      onChange={(e) => {
                        const si = (e.currentTarget as HTMLInputElement)
                          .checked;
                        ponerFiltros({
                          dignidades: DIGNIDADES.filter((x) =>
                            x === d ? si : f.dignidades.includes(x),
                          ),
                        });
                      }}
                    />
                    {DIGNIDAD[d]}
                  </label>
                ))}
                <label class="g-check">
                  <input
                    type="checkbox"
                    checked={f.militancia}
                    onChange={(e) =>
                      ponerFiltros({
                        militancia: (e.currentTarget as HTMLInputElement)
                          .checked,
                      })
                    }
                  />
                  Militancia sin asignar ({enMilitancia})
                </label>
              </div>
            </fieldset>

            <p class="g-com-alcance" aria-live="polite">
              Va a <strong>{total}</strong>{" "}
              {total === 1 ? "persona" : "personas"} en{" "}
              <strong>{filas.length}</strong>{" "}
              {filas.length === 1 ? "número" : "números distintos"}.
              {sinNumero.length > 0
                ? ` ${sinNumero.length} sin celular válido ${sinNumero.length === 1 ? "queda" : "quedan"} fuera.`
                : ""}
              {quitados > 0
                ? ` No se incluye a ${quitados} ${quitados === 1 ? "persona" : "personas"} con el número marcado como equivocado en Contacto o en la lista negra.`
                : ""}
            </p>

            {muestra ? (
              <div class="g-com-vista">
                <small>
                  Vista previa · así le llega a{" "}
                  {muestra.personas.map((p) => p.saludo).join(" y ")}
                </small>
                <p>{muestra.mensaje}</p>
              </div>
            ) : null}
            {conVacios > 0 ? (
              <p class="g-com-aviso">
                En {conVacios} {conVacios === 1 ? "número" : "números"} algún
                dato del mensaje queda en blanco (por ejemplo, la junta de un
                coordinador o el recinto de quien está en Militancia). Revisa
                que el texto se entienda igual.
              </p>
            ) : null}

            <div class="g-form-actions">
              <button
                type="submit"
                class="g-btn-accion"
                disabled={ocupado || !sinGuardar}
              >
                {seleccion === "nuevo" ? "Crear comunicado" : "Guardar cambios"}
              </button>
              {actual && sinGuardar ? (
                <button
                  type="button"
                  class="g-btn-ghost"
                  onClick={() => setBorrador(borradorDe(actual))}
                >
                  Descartar cambios
                </button>
              ) : null}
              {seleccion === "nuevo" ? (
                <button
                  type="button"
                  class="g-btn-ghost"
                  onClick={() => {
                    setSeleccion(comunicados[0]?.id ?? null);
                    setBorrador(
                      comunicados[0] ? borradorDe(comunicados[0]) : NUEVO,
                    );
                  }}
                >
                  Cancelar
                </button>
              ) : null}
              {actual ? (
                <>
                  <button
                    type="button"
                    class="g-btn-ghost"
                    disabled={ocupado}
                    onClick={duplicar}
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    class="g-btn-ghost g-btn-danger-ghost"
                    disabled={ocupado}
                    onClick={eliminar}
                  >
                    Eliminar
                  </button>
                </>
              ) : null}
            </div>
          </form>

          {resultado ? (
            <p class="g-mil-resultado" role="status">
              {resultado}
            </p>
          ) : null}

          {actual ? (
            <section class="g-com-envio" aria-labelledby="g-com-envio-titulo">
              <h2 id="g-com-envio-titulo">Envío</h2>
              {sinGuardar ? (
                <p class="g-com-aviso">
                  Guarda los cambios para seguir enviando: los mensajes salen
                  con el texto guardado.
                </p>
              ) : null}
              <ResumenAvance
                parte={enviados}
                total={filas.length}
                texto={
                  <>
                    <strong>{enviados}</strong> de{" "}
                    <strong>{filas.length}</strong> números enviados
                  </>
                }
                etiquetaBarra="Números a los que ya se envió el comunicado"
              />
              <div class="g-mil-filtros">
                <div class="g-mil-buscar">
                  <label>
                    Buscar
                    <input
                      type="search"
                      value={busqueda}
                      placeholder="Persona, cédula o celular…"
                      onInput={(e) =>
                        setBusqueda((e.currentTarget as HTMLInputElement).value)
                      }
                    />
                  </label>
                </div>
                <div class="g-mil-chips" role="group" aria-label="Envío">
                  {(
                    [
                      ["pendiente", "Por enviar", filas.length - enviados],
                      ["enviado", "Enviados", enviados],
                      ["todos", "Todos", filas.length],
                    ] as const
                  ).map(([clave, etiqueta, n]) => (
                    <button
                      key={clave}
                      type="button"
                      class="g-chip-filtro"
                      aria-pressed={vista === clave}
                      onClick={() => setVista(clave)}
                    >
                      {etiqueta}
                      <span class="g-chip-filtro-n">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
              {visibles.length === 0 ? (
                vista === "pendiente" && !q && filas.length > 0 ? (
                  <p class="g-mil-resultado">
                    Listo: el comunicado ya se envió a todos los números.
                  </p>
                ) : (
                  <VacioFiltros
                    mensaje="Ningún número coincide."
                    onQuitar={() => {
                      setVista("todos");
                      setBusqueda("");
                    }}
                  />
                )
              ) : (
                <ul class="g-contacto-lista g-com-destinatarios">
                  {visibles.map((x) => (
                    <Destinatario
                      key={x.numero}
                      f={x}
                      recintoDe={recintoDe}
                      bloqueado={ocupado || sinGuardar}
                      onEnviado={marcar}
                      onDeshacer={desmarcar}
                    />
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
