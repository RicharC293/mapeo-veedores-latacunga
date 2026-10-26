import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import FiltrosRecintos, {
  ResumenAvance,
  VacioFiltros,
} from "./FiltrosRecintos";
import GrupoParroquia from "./GrupoParroquia";
import Iniciales from "./Iniciales";
import Resaltado from "./Resaltado";
import {
  claveDePuesto,
  enlaceWhatsapp,
  mensajeWhatsapp,
  nombreDeSaludo,
  situacionContacto,
  telefonoWhatsapp,
  textoJunta,
  type Clase,
  type Contacto,
  type EstadoContacto,
  type PuestoContacto,
  type SituacionContacto,
} from "../../lib/contacto/plan";
import {
  datosPersonales,
  estadoIdentidad,
  motivoNoApto,
  type ValidacionCedula,
} from "../../lib/validacion/plan";
import {
  agruparPorParroquia,
  coincideUbicacion,
  type Ubicacion,
} from "../../lib/gestion/ubicacion";
import { normalizar, title } from "../../lib/format";
import type { ParroquiaBasica, Recinto } from "../../lib/types";
import type {
  AcreditadoCda,
  Coordinador,
  Veedor,
} from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaBasica[];
  recintos: Recinto[];
  lideres: { id: string; nombres: string }[];
  veedores: Veedor[];
  coordinadores: Coordinador[];
  acreditados: AcreditadoCda[];
  validaciones: ValidacionCedula[];
  contactos: Contacto[];
  // false si la tabla de contactos aún no existe (falta la migración).
  tablaLista: boolean;
}

type Filtro =
  | "pendiente"
  | "enviado"
  | "confirmado"
  | "sincedula"
  | "numero_equivocado"
  | "todos";

interface Fila {
  id: string;
  clase: Clase;
  cedula: string;
  nombres: string;
  telefono: string;
  responsable: string | null;
  recinto: Recinto;
  parroquia: ParroquiaBasica | undefined;
  puesto: PuestoContacto;
  numero: string | null;
  mensaje: string;
  contacto: Contacto | undefined;
  situacion: SituacionContacto;
}

const RUTA_API: Record<Clase, string> = {
  veedor: "/api/gestion/veedores",
  coordinador: "/api/gestion/coordinadores",
  cda: "/api/gestion/acreditados-cda",
};

const PUESTO: Record<Clase, string> = {
  coordinador: "Coordinador",
  cda: "Acreditado CDA",
  veedor: "Veedor",
};
// Dentro de un recinto: coordinador, CDA y luego los veedores por junta.
const ORDEN: Record<Clase, number> = { coordinador: 0, cda: 1, veedor: 2 };

const ESTADO: Record<EstadoContacto, { texto: string; clase: string }> = {
  pendiente: { texto: "Por contactar", clase: "chip-estado-sin" },
  enviado: { texto: "Esperando respuesta", clase: "chip-estado-casi" },
  confirmado: { texto: "Confirmó", clase: "chip-estado-ok" },
  numero_equivocado: {
    texto: "Número equivocado",
    clase: "chip-estado-pendiente",
  },
};

const enFiltro = (f: Fila, filtro: Filtro) =>
  filtro === "todos" ||
  (filtro === "sincedula"
    ? f.situacion.estado === "confirmado" && !f.contacto?.cedulaRecibida
    : filtro === "pendiente"
      ? f.situacion.estado === "pendiente" ||
        (f.situacion.cambioDePuesto && f.situacion.estado !== "confirmado")
      : f.situacion.estado === filtro);

const fechaHora = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as T;
}

const HOY = new Date();

// Desvincular a quien no participa: pasa a la lista negra con el motivo.
function DialogoNoParticipa({
  fila,
  onConfirmar,
  onCerrar,
}: {
  fila: Fila;
  onConfirmar: (motivo: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const enviar = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onConfirmar(motivo.trim());
      ref.current?.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setEnviando(false);
    }
  };
  return (
    <dialog
      ref={ref}
      class="g-dialogo g-dialogo-no-participa"
      aria-labelledby="g-no-participa-titulo"
      onClose={onCerrar}
    >
      <h3 id="g-no-participa-titulo">{fila.nombres} no participa</h3>
      <p class="g-sub">
        Se desvincula de su puesto y pasa a la lista negra con este motivo. El
        puesto queda libre para otra persona.
      </p>
      <form class="g-form g-form-danger" onSubmit={enviar}>
        <label>
          ¿Por qué no participa?
          <textarea
            required
            rows={3}
            value={motivo}
            placeholder="Por ejemplo: viaja ese fin de semana"
            onInput={(e) =>
              setMotivo((e.currentTarget as HTMLTextAreaElement).value)
            }
          />
        </label>
        {error ? <p class="g-error">{error}</p> : null}
        <div class="g-form-actions">
          <button
            type="submit"
            class="g-btn-danger"
            disabled={enviando || motivo.trim() === ""}
          >
            {enviando ? "Enviando…" : "Enviar a la lista negra"}
          </button>
          <button
            type="button"
            class="g-btn-ghost"
            onClick={() => ref.current?.close()}
          >
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Persona({
  f,
  busqueda,
  ocupado,
  onAccion,
  onNoParticipa,
}: {
  f: Fila;
  busqueda: string;
  ocupado: boolean;
  onAccion: (
    f: Fila,
    accion:
      "enviado" | "confirmado" | "numero_equivocado" | "pendiente" | "cedula",
    recibida?: boolean,
  ) => void;
  onNoParticipa: (f: Fila) => void;
}) {
  const { estado, cambioDePuesto, verificadoAntes } = f.situacion;
  const c = f.contacto;
  const chip = ESTADO[estado];
  const [copiado, setCopiado] = useState(false);
  // Para enviarlo por otro medio o pegarlo en WhatsApp a mano: copiar no
  // cuenta como enviado.
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
      <div class="g-consol-persona">
        <Iniciales nombres={f.nombres} rol={f.puesto.tipo} />
        <div class="g-consol-persona-texto">
          <strong>
            <Resaltado texto={f.nombres} consulta={busqueda} />
          </strong>
          <small class="g-persona-pref">
            {PUESTO[f.clase]} {f.puesto.tipo}
            {f.puesto.juntaId
              ? ` · ${textoJunta(f.puesto.juntaId)}`
              : ""} ·{" "}
            <Resaltado texto={title(f.recinto.nombre)} consulta={busqueda} />
          </small>
          <small>
            CI <Resaltado texto={f.cedula} consulta={busqueda} />
            {f.telefono ? (
              <>
                {" · "}
                <Resaltado texto={f.telefono} consulta={busqueda} />
              </>
            ) : null}
            {f.responsable ? ` · ${f.responsable}` : ""}
          </small>
          <span class="g-contacto-estado">
            <span class={`chip-estado ${chip.clase}`}>{chip.texto}</span>
            {c?.cedulaRecibida ? (
              <span class="chip-estado chip-estado-ok">Cédula recibida</span>
            ) : null}
            {c?.ultimoEnvio ? (
              <small>
                {c.intentos === 1
                  ? "Mensaje enviado"
                  : `${c.intentos} mensajes enviados`}{" "}
                · último {fechaHora.format(new Date(c.ultimoEnvio))}
              </small>
            ) : verificadoAntes ? (
              <small>Verificado antes del contacto por WhatsApp</small>
            ) : null}
          </span>
          {cambioDePuesto ? (
            <small class="g-contacto-aviso">
              Cambió de puesto después del mensaje: vuelve a enviarlo.
            </small>
          ) : null}
        </div>
      </div>
      <div class="g-contacto-acciones">
        {f.numero ? (
          <a
            class="g-btn-whatsapp"
            href={enlaceWhatsapp(f.numero, f.mensaje)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={ocupado ? "true" : undefined}
            onClick={() => onAccion(f, "enviado")}
          >
            {estado === "pendiente" ? "Enviar WhatsApp" : "Reenviar"}
          </a>
        ) : (
          <span class="g-contacto-sin-numero">Celular inválido</span>
        )}
        <button
          type="button"
          class="g-btn-ghost"
          aria-live="polite"
          onClick={copiar}
        >
          {copiado ? "¡Copiado!" : "Copiar mensaje"}
        </button>
        {estado !== "confirmado" ? (
          <button
            type="button"
            class="g-btn-ghost"
            disabled={ocupado}
            onClick={() => onAccion(f, "confirmado")}
          >
            Confirmó
          </button>
        ) : null}
        {estado === "enviado" ? (
          <button
            type="button"
            class="g-btn-ghost"
            disabled={ocupado}
            onClick={() => onAccion(f, "numero_equivocado")}
          >
            Número equivocado
          </button>
        ) : null}
        <button
          type="button"
          class="g-btn-danger-ghost"
          disabled={ocupado}
          onClick={() => onNoParticipa(f)}
        >
          No participa
        </button>
        {estado !== "pendiente" ? (
          <label class="g-check g-contacto-cedula">
            <input
              type="checkbox"
              checked={c?.cedulaRecibida ?? false}
              disabled={ocupado}
              onChange={(e) =>
                onAccion(
                  f,
                  "cedula",
                  (e.currentTarget as HTMLInputElement).checked,
                )
              }
            />
            Cédula recibida
          </label>
        ) : null}
        {estado !== "pendiente" && !verificadoAntes ? (
          <button
            type="button"
            class="g-btn-link"
            disabled={ocupado}
            onClick={() => onAccion(f, "pendiente")}
          >
            Volver a por contactar
          </button>
        ) : null}
      </div>
    </li>
  );
}

export default function GestionContacto({
  parroquias,
  recintos,
  lideres,
  veedores: veedoresIniciales,
  coordinadores: coordinadoresIniciales,
  acreditados: acreditadosIniciales,
  validaciones,
  contactos: contactosIniciales,
  tablaLista,
}: Props) {
  const [veedores, setVeedores] = useState(veedoresIniciales);
  const [coordinadores, setCoordinadores] = useState(coordinadoresIniciales);
  const [acreditados, setAcreditados] = useState(acreditadosIniciales);
  const [contactos, setContactos] = useState(contactosIniciales);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("todas");
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [busqueda, setBusqueda] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [noParticipa, setNoParticipa] = useState<Fila | null>(null);

  const recintoDe = useMemo(
    () => new Map(recintos.map((r) => [r.cod, r])),
    [recintos],
  );
  const parroquiaDe = useMemo(
    () => new Map(parroquias.map((p) => [p.properties.code, p])),
    [parroquias],
  );
  const nombreLider = useMemo(
    () => new Map(lideres.map((l) => [l.id, l.nombres])),
    [lideres],
  );
  const validacionDe = useMemo(
    () => new Map(validaciones.map((v) => [v.cedula, v])),
    [validaciones],
  );
  const contactoDe = useMemo(
    () => new Map(contactos.map((c) => [c.cedula, c])),
    [contactos],
  );

  // Solo entra quien pasó la verificación 2: identidad confirmada en el
  // Registro Civil (nombre ya en el formato oficial) y mayor de edad.
  const { filas, sinVerificar } = useMemo(() => {
    const personas = [
      ...coordinadores.map((p) => ({
        p,
        clase: "coordinador" as const,
        juntaId: null,
      })),
      ...acreditados.map((p) => ({ p, clase: "cda" as const, juntaId: null })),
      ...veedores.map((p) => ({
        p,
        clase: "veedor" as const,
        juntaId: p.juntaId,
      })),
    ];
    const lista: Fila[] = [];
    let pendientes = 0;
    for (const { p, clase, juntaId } of personas) {
      const recinto = recintoDe.get(p.recintoCodigo);
      if (!recinto) continue;
      const cedula = p.cedula.trim();
      const v = validacionDe.get(cedula);
      if (
        estadoIdentidad(p.nombres, cedula, v).estado !== "verificada" ||
        motivoNoApto(cedula, v, HOY)
      ) {
        pendientes += 1;
        continue;
      }
      const puesto: PuestoContacto = {
        clase,
        tipo: p.tipo,
        recintoCodigo: p.recintoCodigo,
        juntaId,
      };
      const contacto = contactoDe.get(cedula);
      lista.push({
        id: p.id,
        clase,
        cedula,
        nombres: p.nombres,
        telefono: p.telefono,
        responsable: p.responsableLiderId
          ? (nombreLider.get(p.responsableLiderId) ?? null)
          : null,
        recinto,
        parroquia: parroquiaDe.get(recinto.par),
        puesto,
        numero: telefonoWhatsapp(p.telefono),
        mensaje: mensajeWhatsapp({
          nombre: nombreDeSaludo(p.nombres, v?.nombres ?? null),
          femenino: datosPersonales(v).genero === "femenino",
          clase,
          tipo: p.tipo,
          recinto: recinto.nombre,
          parroquia: parroquiaDe.get(recinto.par)?.properties.name ?? "",
          direccion: recinto.dir,
          juntaId,
        }),
        contacto,
        situacion: situacionContacto(puesto, p.verificado, contacto),
      });
    }
    lista.sort(
      (a, b) =>
        ORDEN[a.clase] - ORDEN[b.clase] ||
        (a.puesto.juntaId ?? "").localeCompare(b.puesto.juntaId ?? "", "es", {
          numeric: true,
        }) ||
        Number(a.puesto.tipo === "suplente") -
          Number(b.puesto.tipo === "suplente"),
    );
    return { filas: lista, sinVerificar: pendientes };
  }, [
    veedores,
    coordinadores,
    acreditados,
    recintoDe,
    parroquiaDe,
    nombreLider,
    validacionDe,
    contactoDe,
  ]);

  const base = useMemo(() => {
    const q = normalizar(busqueda);
    return filas.filter(
      (f) =>
        coincideUbicacion(ubicacion, f.parroquia) &&
        (!q ||
          normalizar(
            `${f.nombres} ${f.cedula} ${f.telefono} ${f.recinto.nombre} ${f.parroquia?.properties.name ?? ""}`,
          ).includes(q)),
    );
  }, [filas, ubicacion, busqueda]);
  const cuenta = (x: Filtro) => base.filter((f) => enFiltro(f, x)).length;
  const visibles = base.filter((f) => enFiltro(f, filtro));
  const grupos = agruparPorParroquia(visibles, parroquias);

  const confirmados = filas.filter((f) => f.situacion.estado === "confirmado");
  const conCedula = confirmados.filter((f) => f.contacto?.cedulaRecibida);

  const hayFiltros =
    ubicacion !== "todas" || filtro !== "pendiente" || busqueda !== "";
  const quitarFiltros = () => {
    setUbicacion("todas");
    setFiltro("pendiente");
    setBusqueda("");
  };

  const guardarContacto = (cedula: string, c: Contacto | null) =>
    setContactos((lista) => [
      ...lista.filter((x) => x.cedula !== cedula),
      ...(c ? [c] : []),
    ]);

  // El verificado de su puesto cambia al confirmar (o al dejar de estarlo).
  const ponerVerificado = (cedula: string, verificado: boolean) => {
    const cambiar = <T extends { cedula: string; verificado: boolean }>(
      lista: T[],
    ) =>
      lista.map((p) => (p.cedula.trim() === cedula ? { ...p, verificado } : p));
    setVeedores(cambiar);
    setCoordinadores(cambiar);
    setAcreditados(cambiar);
  };

  const accion = async (
    f: Fila,
    a: "enviado" | "confirmado" | "numero_equivocado" | "pendiente" | "cedula",
    recibida?: boolean,
  ) => {
    setOcupado(true);
    setResultado(null);
    try {
      const c = await api<Contacto | null>("/api/gestion/contacto", {
        method: "POST",
        body: JSON.stringify({
          cedula: f.cedula,
          accion: a,
          puesto: claveDePuesto(f.puesto),
          recibida,
        }),
      });
      guardarContacto(f.cedula, c);
      ponerVerificado(f.cedula, c?.estado === "confirmado");
      if (a === "confirmado") {
        setResultado(`${f.nombres} confirmó su participación.`);
      }
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setOcupado(false);
    }
  };

  const desvincular = async (f: Fila, motivo: string) => {
    // Primero se borra su contacto (después ya no estaría en el Consolidado).
    await api("/api/gestion/contacto", {
      method: "POST",
      body: JSON.stringify({ cedula: f.cedula, accion: "pendiente" }),
    });
    guardarContacto(f.cedula, null);
    await api(`${RUTA_API[f.clase]}/${f.id}/desvincular`, {
      method: "POST",
      body: JSON.stringify({
        motivo: `No participa (contacto por WhatsApp): ${motivo}`,
        listaNegra: true,
      }),
    });
    const sinEl = <T extends { id: string }>(lista: T[]) =>
      lista.filter((p) => p.id !== f.id);
    if (f.clase === "veedor") setVeedores(sinEl);
    else if (f.clase === "coordinador") setCoordinadores(sinEl);
    else setAcreditados(sinEl);
    setResultado(`${f.nombres} pasó a la lista negra y su puesto quedó libre.`);
  };

  if (!tablaLista) {
    return (
      <div class="g-panel">
        <p class="g-error">
          Falta crear la tabla de contactos en la base de datos: aplica la
          migración <code>20261028000001_contactos.sql</code>.
        </p>
      </div>
    );
  }

  return (
    <div class="g-panel">
      <div class="g-consol-resumen">
        <ResumenAvance
          parte={confirmados.length}
          total={filas.length}
          texto={
            <>
              <strong>{confirmados.length}</strong> de{" "}
              <strong>{filas.length}</strong> personas confirmaron
            </>
          }
          etiquetaBarra="Personas que confirmaron su participación"
        />
        <ResumenAvance
          parte={conCedula.length}
          total={confirmados.length}
          texto={
            <>
              <strong>{conCedula.length}</strong> de{" "}
              <strong>{confirmados.length}</strong> confirmados entregaron la
              cédula
            </>
          }
          etiquetaBarra="Confirmados que entregaron la cédula"
        />
      </div>
      {sinVerificar > 0 ? (
        <p class="g-contacto-nota">
          {sinVerificar === 1
            ? "1 persona del Consolidado aún no tiene"
            : `${sinVerificar} personas del Consolidado aún no tienen`}{" "}
          la identidad verificada (o es menor de edad). Aparecerán aquí cuando
          se verifiquen en el <a href="/gestion/consolidado">Consolidado</a>.
        </p>
      ) : null}

      <FiltrosRecintos
        parroquias={parroquias}
        ubicacion={ubicacion}
        onUbicacion={setUbicacion}
        estados={[
          {
            clave: "pendiente",
            etiqueta: "Por contactar",
            n: cuenta("pendiente"),
            alerta: true,
          },
          {
            clave: "enviado",
            etiqueta: "Esperando respuesta",
            n: cuenta("enviado"),
            aviso: true,
          },
          {
            clave: "confirmado",
            etiqueta: "Confirmaron",
            n: cuenta("confirmado"),
          },
          {
            clave: "sincedula",
            etiqueta: "Falta la cédula",
            n: cuenta("sincedula"),
            aviso: true,
          },
          {
            clave: "numero_equivocado",
            etiqueta: "Número equivocado",
            n: cuenta("numero_equivocado"),
            alerta: true,
          },
          { clave: "todos", etiqueta: "Todos", n: base.length },
        ]}
        estado={filtro}
        onEstado={setFiltro}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Persona, cédula, celular o recinto…"
        contador={`Mostrando ${visibles.length} de ${filas.length} personas`}
        hayFiltros={hayFiltros}
        onQuitar={quitarFiltros}
      />

      {resultado ? (
        <p class="g-mil-resultado" role="status">
          {resultado}
        </p>
      ) : null}

      {grupos.length === 0 ? (
        <VacioFiltros
          mensaje="Nadie coincide con estos filtros."
          onQuitar={quitarFiltros}
        />
      ) : (
        grupos.map((g) => (
          <GrupoParroquia
            key={g.parroquia?.properties.code ?? "sin-parroquia"}
            parroquia={g.parroquia}
            busqueda={busqueda}
            cuenta={`${g.items.length} ${g.items.length === 1 ? "persona" : "personas"}`}
          >
            <ul class="g-contacto-lista">
              {g.items.map((f) => (
                <Persona
                  key={f.id}
                  f={f}
                  busqueda={busqueda}
                  ocupado={ocupado}
                  onAccion={accion}
                  onNoParticipa={setNoParticipa}
                />
              ))}
            </ul>
          </GrupoParroquia>
        ))
      )}

      {noParticipa ? (
        <DialogoNoParticipa
          fila={noParticipa}
          onConfirmar={(motivo) => desvincular(noParticipa, motivo)}
          onCerrar={() => setNoParticipa(null)}
        />
      ) : null}
    </div>
  );
}
