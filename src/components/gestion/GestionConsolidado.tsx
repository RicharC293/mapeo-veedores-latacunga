import { useMemo, useState } from "preact/hooks";
import FiltrosRecintos, {
  ResumenAvance,
  VacioFiltros,
} from "./FiltrosRecintos";
import BotonIcono from "./BotonIcono";
import DialogoDesvincular from "./DialogoDesvincular";
import DialogoMover from "./DialogoMover";
import GrupoParroquia from "./GrupoParroquia";
import Resaltado from "./Resaltado";
import AlertaMesasInexistentes from "./AlertaMesasInexistentes";
import { veedoresEnMesaInexistente } from "../../lib/gestion/mesasInexistentes";
import Iniciales from "./Iniciales";
import SincronizarIdentidad from "./SincronizarIdentidad";
import {
  ETIQUETA_GENERO,
  edad,
  sePuedeConsultar,
  vistaIdentidad,
  type EstadoIdentidad,
  type IdentidadVista,
  type ValidacionCedula,
} from "../../lib/validacion/plan";
import { useRecintosAbiertos } from "./useRecintosAbiertos";
import { normalizar, title } from "../../lib/format";
import {
  agruparPor,
  consolidarRecinto,
  type Puesto,
} from "../../lib/gestion/consolidado";
import {
  PUESTO_CLASE,
  etiquetaJunta,
  type Clase,
  type DestinoSolicitado,
} from "../../lib/gestion/movimiento";
import {
  agruparPorParroquia,
  coincideUbicacion,
  type Ubicacion,
} from "../../lib/gestion/ubicacion";
import type { ParroquiaBasica, Recinto } from "../../lib/types";
import type {
  AcreditadoCda,
  Coordinador,
  Veedor,
} from "../../lib/gestion/types";

interface PersonaVista {
  id: string;
  recintoCodigo: number;
  // Solo los veedores tienen junta.
  juntaId?: string;
  cedula: string;
  nombres: string;
  telefono: string;
  email: string;
  preferencia?: string;
  responsableLiderId: string | null;
  verificado: boolean;
}

interface Props {
  parroquias: ParroquiaBasica[];
  recintos: Recinto[];
  lideres: { id: string; nombres: string }[];
  veedores: Veedor[];
  coordinadores: Coordinador[];
  acreditados: AcreditadoCda[];
  // Verificación de identidad en el Registro Civil, por cédula.
  validaciones?: ValidacionCedula[];
  // El administrador puede sincronizar y decidir los nombres.
  puedeVerificar?: boolean;
  hayClave?: boolean;
  costoPorConsulta?: number;
}

// Decisiones sobre el nombre de una persona frente al oficial.
interface VerifAcciones {
  onUsar: (cedula: string) => void;
  onMantener: (cedula: string) => void;
  onDeshacer: (cedula: string) => void;
  ocupado: boolean;
}

type FiltroIdentidad =
  "todas" | "sinconsultar" | "coincide" | "revisar" | "verificada" | "problema";

const IDENTIDAD: Record<EstadoIdentidad, { texto: string; clase: string }> = {
  verificada: { texto: "Identidad verificada", clase: "g-consol-identidad-ok" },
  coincide: { texto: "Coincide", clase: "g-consol-identidad-revisar" },
  revisar: { texto: "Nombre por revisar", clase: "g-consol-identidad-revisar" },
  no_encontrada: {
    texto: "No encontrada en el Registro Civil",
    clase: "g-consol-identidad-mal",
  },
  invalida: { texto: "Cédula inválida", clase: "g-consol-identidad-mal" },
  error: {
    texto: "Sin verificar (error al consultar)",
    clase: "g-consol-identidad-sin",
  },
  sin_consultar: { texto: "Sin verificar", clase: "g-consol-identidad-sin" },
};

const enFiltroIdentidad = (e: EstadoIdentidad, f: FiltroIdentidad) =>
  f === "todas" ||
  (f === "sinconsultar"
    ? e === "sin_consultar" || e === "error"
    : f === "problema"
      ? e === "no_encontrada" || e === "invalida"
      : e === f);

type Estado = "todos" | "completos" | "casi" | "pendientes" | "excedente";

// Con pocos recintos a la vista, su detalle se muestra abierto.
const ABRIR_SI_HAY_HASTA = 2;

type Persona = PersonaVista & { tipo: "titular" | "suplente"; orden: number };

interface Acciones {
  onMover: (clase: Clase, p: Persona) => void;
  onDesvincular: (clase: Clase, p: Persona) => void;
}

// Lo que el diálogo activo necesita saber de la persona.
type Dialogo =
  | { tipo: "mover"; clase: Clase; p: Persona }
  | { tipo: "desvincular"; clase: Clase; p: Persona }
  | null;

const RUTA_API: Record<Clase, string> = {
  veedor: "/api/gestion/veedores",
  coordinador: "/api/gestion/coordinadores",
  cda: "/api/gestion/acreditados-cda",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as T;
}

// Estado de identidad bajo el nombre: "Identidad verificada · 34 años ·
// Masculino", el nombre oficial cuando difiere y, a pedido, la respuesta del
// Registro Civil. El nombre anterior no se muestra: queda en el ícono de
// deshacer ("Deshacer: volver a …").
const HOY = new Date();
function LineaIdentidad({
  identidad,
  verRespuesta,
}: {
  identidad: IdentidadVista | undefined;
  verRespuesta: boolean;
}) {
  if (!identidad) return null;
  const e = edad(identidad.fechaNacimiento, HOY);
  const partes = [
    e !== null ? `${e} años` : null,
    identidad.genero ? ETIQUETA_GENERO[identidad.genero] : null,
  ].filter(Boolean);
  const estado = IDENTIDAD[identidad.estado];
  return (
    <>
      <small class="g-consol-identidad">
        <span class={estado.clase}>{estado.texto}</span>
        {partes.length > 0 ? <span>{partes.join(" · ")}</span> : null}
      </small>
      {identidad.oficial &&
      (identidad.estado === "coincide" || identidad.estado === "revisar") ? (
        <small class="g-persona-pref">Oficial: {identidad.oficial}</small>
      ) : null}
      {identidad.error && identidad.estado !== "sin_consultar" ? (
        <small>{identidad.error}</small>
      ) : null}
      {verRespuesta && identidad.respuesta ? (
        <pre class="g-consol-respuesta">
          {JSON.stringify(identidad.respuesta, null, 2)}
        </pre>
      ) : null}
    </>
  );
}

function Linea({
  p,
  busqueda,
  identidad,
  verif,
  rol,
  clase,
  nombreLider,
  acciones,
}: {
  p: Persona;
  busqueda: string;
  identidad: IdentidadVista | undefined;
  verif: VerifAcciones | null;
  rol: "titular" | "suplente";
  clase: Clase;
  nombreLider: Map<string, string>;
  acciones: Acciones;
}) {
  const responsable = p.responsableLiderId
    ? nombreLider.get(p.responsableLiderId)
    : undefined;
  const [verRespuesta, setVerRespuesta] = useState(false);
  const decidir =
    identidad?.estado === "coincide" || identidad?.estado === "revisar";
  return (
    <div class="g-consol-persona">
      <Iniciales nombres={p.nombres} rol={rol} />
      <div class="g-consol-persona-texto">
        <strong>
          <Resaltado texto={p.nombres} consulta={busqueda} />
        </strong>
        <small>
          CI <Resaltado texto={p.cedula} consulta={busqueda} />
          {p.telefono ? (
            <>
              {" · "}
              <Resaltado texto={p.telefono} consulta={busqueda} />
            </>
          ) : (
            ""
          )}
          {p.email ? ` · ${p.email}` : ""}
          {responsable ? ` · ${responsable}` : ""}
        </small>
        {p.preferencia ? (
          <small class="g-persona-pref">Preferencia: {p.preferencia}</small>
        ) : null}
        <LineaIdentidad identidad={identidad} verRespuesta={verRespuesta} />
        {p.verificado ? (
          <span class="chip-estado chip-estado-ok">Verificado</span>
        ) : null}
      </div>
      <div class="g-consol-acciones">
        {verif && decidir ? (
          <>
            <BotonIcono
              icono="check"
              etiqueta={`Usar el nombre oficial: ${identidad?.oficial ?? ""}`}
              disabled={verif.ocupado}
              onClick={() => verif.onUsar(p.cedula)}
            />
            <BotonIcono
              icono="candado"
              etiqueta={`Mantener el nombre actual de ${p.nombres}`}
              disabled={verif.ocupado}
              onClick={() => verif.onMantener(p.cedula)}
            />
          </>
        ) : null}
        {verif && identidad?.nombreAnterior ? (
          <BotonIcono
            icono="deshacer"
            etiqueta={`Deshacer: volver a ${identidad.nombreAnterior}`}
            disabled={verif.ocupado}
            onClick={() => verif.onDeshacer(p.cedula)}
          />
        ) : null}
        {verif && identidad?.respuesta ? (
          <BotonIcono
            icono="documento"
            etiqueta="Ver la respuesta del Registro Civil"
            presionado={verRespuesta}
            onClick={() => setVerRespuesta((v) => !v)}
          />
        ) : null}
        <BotonIcono
          icono="mover"
          etiqueta={`Mover a ${p.nombres}`}
          onClick={() => acciones.onMover(clase, p)}
        />
        <BotonIcono
          icono="basura"
          peligro
          etiqueta={`Desvincular a ${p.nombres}`}
          onClick={() => acciones.onDesvincular(clase, p)}
        />
      </div>
    </div>
  );
}

// Titular de un puesto (o aviso de que falta) y sus suplentes.
function PuestoLineas({
  busqueda,
  identidad,
  verif,
  puesto,
  falta,
  clase,
  nombreLider,
  acciones,
}: {
  busqueda: string;
  identidad: (p: Persona) => IdentidadVista | undefined;
  verif: VerifAcciones | null;
  puesto: Puesto<Persona>;
  falta: string;
  clase: Clase;
  nombreLider: Map<string, string>;
  acciones: Acciones;
}) {
  return (
    <>
      {puesto.titular ? (
        <Linea
          p={puesto.titular}
          busqueda={busqueda}
          identidad={identidad(puesto.titular)}
          verif={verif}
          rol="titular"
          clase={clase}
          nombreLider={nombreLider}
          acciones={acciones}
        />
      ) : (
        <p class="g-consol-falta">{falta}</p>
      )}
      {puesto.suplentes.map((s, i) => (
        <div class="g-consol-suplente" key={i}>
          <span class="g-consol-rol">Suplente</span>
          <Linea
            p={s}
            busqueda={busqueda}
            identidad={identidad(s)}
            verif={verif}
            rol="suplente"
            clase={clase}
            nombreLider={nombreLider}
            acciones={acciones}
          />
        </div>
      ))}
    </>
  );
}

export default function GestionConsolidado({
  parroquias,
  recintos,
  lideres,
  veedores: veedoresIniciales,
  coordinadores: coordinadoresIniciales,
  acreditados: acreditadosIniciales,
  validaciones: validacionesIniciales = [],
  puedeVerificar = false,
  hayClave = false,
  costoPorConsulta = 0.02,
}: Props) {
  const [veedores, setVeedores] = useState(veedoresIniciales);
  const [coordinadores, setCoordinadores] = useState(coordinadoresIniciales);
  const [acreditados, setAcreditados] = useState(acreditadosIniciales);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("todas");
  const [estado, setEstado] = useState<Estado>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [validaciones, setValidaciones] = useState(validacionesIniciales);
  const [filtroIdentidad, setFiltroIdentidad] =
    useState<FiltroIdentidad>("todas");
  const [decidiendo, setDecidiendo] = useState(false);

  const validacionDe = useMemo(
    () => new Map(validaciones.map((v) => [v.cedula, v])),
    [validaciones],
  );
  // Identidad de cada persona, con su nombre actual (cambia al aplicar el
  // oficial). Sin la tabla de validaciones no se muestra nada.
  const identidad = (p: PersonaVista): IdentidadVista | undefined =>
    validaciones.length === 0 && !puedeVerificar
      ? undefined
      : vistaIdentidad(p.nombres, p.cedula, validacionDe.get(p.cedula.trim()));

  const nombreLider = useMemo(
    () => new Map(lideres.map((l) => [l.id, l.nombres])),
    [lideres],
  );

  // Un registro por recinto con todo lo que necesita y quién lo cubre.
  const filas = useMemo(() => {
    const vPorRecinto = agruparPor(veedores, (v) => v.recintoCodigo);
    const cPorRecinto = agruparPor(coordinadores, (c) => c.recintoCodigo);
    const aPorRecinto = agruparPor(acreditados, (a) => a.recintoCodigo);
    return recintos.map((recinto) => ({
      ...consolidarRecinto(
        recinto,
        (cPorRecinto.get(recinto.cod) ?? []) as Coordinador[],
        (aPorRecinto.get(recinto.cod) ?? []) as AcreditadoCda[],
        (vPorRecinto.get(recinto.cod) ?? []) as Veedor[],
      ),
      parroquia: parroquias.find((p) => p.properties.code === recinto.par),
    }));
  }, [recintos, parroquias, veedores, coordinadores, acreditados]);

  // Recintos tras ubicación y búsqueda (los conteos de los chips de estado y
  // el resumen salen de aquí).
  const base = useMemo(() => {
    const q = normalizar(busqueda);
    return filas.filter((f) => {
      if (!coincideUbicacion(ubicacion, f.parroquia)) return false;
      if (!q) return true;
      const personas: PersonaVista[] = [
        ...(f.coordinador.titular ? [f.coordinador.titular] : []),
        ...f.coordinador.suplentes,
        ...(f.cda?.titular ? [f.cda.titular] : []),
        ...(f.cda?.suplentes ?? []),
        ...f.juntas.flatMap((j) => [
          ...(j.puesto.titular ? [j.puesto.titular] : []),
          ...j.puesto.suplentes,
        ]),
      ];
      return normalizar(
        [
          f.recinto.nombre,
          f.parroquia?.properties.name ?? "",
          ...personas.map((p) => `${p.nombres} ${p.cedula} ${p.telefono}`),
        ].join(" "),
      ).includes(q);
    });
  }, [filas, ubicacion, busqueda]);

  const completos = base.filter((f) => f.completo).length;
  const conExcedente = base.filter((f) => f.excedente > 0).length;
  const casiCompletos = base.filter((f) => f.casiCompleto).length;
  const personasDe = (f: (typeof filas)[number]): PersonaVista[] => [
    ...(f.coordinador.titular ? [f.coordinador.titular] : []),
    ...f.coordinador.suplentes,
    ...(f.cda?.titular ? [f.cda.titular] : []),
    ...(f.cda?.suplentes ?? []),
    ...f.juntas.flatMap((j) => [
      ...(j.puesto.titular ? [j.puesto.titular] : []),
      ...j.puesto.suplentes,
    ]),
  ];
  const coincideIdentidad = (f: (typeof filas)[number]) =>
    filtroIdentidad === "todas" ||
    personasDe(f).some((p) => {
      const i = identidad(p);
      return i ? enFiltroIdentidad(i.estado, filtroIdentidad) : false;
    });
  const visibles = base
    .filter(coincideIdentidad)
    .filter((f) =>
      estado === "completos"
        ? f.completo
        : estado === "casi"
          ? f.casiCompleto
          : estado === "pendientes"
            ? !f.completo
            : estado === "excedente"
              ? f.excedente > 0
              : true,
    );
  const grupos = useMemo(
    () => agruparPorParroquia(visibles, parroquias),
    [visibles, parroquias],
  );

  const conCoordinador = base.filter((f) => f.coordinador.titular).length;
  const recintosCda = base.filter((f) => f.cda);
  const conCda = recintosCda.filter((f) => f.cda?.titular).length;
  const totalJuntas = base.reduce((a, f) => a + f.juntas.length, 0);
  const juntasConTitular = base.reduce((a, f) => a + f.juntasConTitular, 0);

  const hayFiltros =
    ubicacion !== "todas" ||
    estado !== "todos" ||
    busqueda !== "" ||
    filtroIdentidad !== "todas";
  const quitarFiltros = () => {
    setUbicacion("todas");
    setEstado("todos");
    setBusqueda("");
    setFiltroIdentidad("todas");
  };

  // Todas las personas del Consolidado (sin filtros): para Sincronizar y para
  // aplicar en bloque los nombres que coinciden.
  const todas = useMemo(
    () => [...veedores, ...coordinadores, ...acreditados],
    [veedores, coordinadores, acreditados],
  );
  const pendientes = [
    ...new Set(
      todas
        .filter((p) =>
          sePuedeConsultar(p.cedula, validacionDe.get(p.cedula.trim())),
        )
        .map((p) => p.cedula.trim()),
    ),
  ];
  const coinciden = [
    ...new Set(
      todas
        .filter((p) => identidad(p)?.estado === "coincide")
        .map((p) => p.cedula.trim()),
    ),
  ];
  const { estaAbierto, alternar } = useRecintosAbiertos(
    visibles.length <= ABRIR_SI_HAY_HASTA,
  );

  const refrescar = async () => {
    const [v, c, a] = await Promise.all([
      api<Veedor[]>(RUTA_API.veedor),
      api<Coordinador[]>(RUTA_API.coordinador),
      api<AcreditadoCda[]>(RUTA_API.cda),
    ]);
    setVeedores(v);
    setCoordinadores(c);
    setAcreditados(a);
  };

  const refrescarValidaciones = async () => {
    setValidaciones(await api<ValidacionCedula[]>("/api/gestion/validacion"));
  };

  // Usar el oficial, mantener el actual o deshacer: cambian nombres, así que
  // se recargan las personas y las validaciones.
  const decidirNombre = async (
    accion: "aplicar" | "mantener" | "deshacer",
    cedulas: string[],
  ) => {
    setDecidiendo(true);
    setResultado(
      accion === "aplicar"
        ? "Aplicando el nombre oficial…"
        : accion === "mantener"
          ? "Guardando…"
          : "Devolviendo el nombre anterior…",
    );
    try {
      await api(`/api/gestion/validacion/${accion}`, {
        method: "POST",
        body: JSON.stringify({ cedulas }),
      });
      await Promise.all([refrescar(), refrescarValidaciones()]);
      const n = cedulas.length;
      const personas = `${n} ${n === 1 ? "persona" : "personas"}`;
      setResultado(
        accion === "aplicar"
          ? `Nombre oficial aplicado a ${personas}.`
          : accion === "mantener"
            ? `Se mantuvo el nombre actual de ${personas}.`
            : `Se devolvió el nombre anterior a ${personas}.`,
      );
    } catch (err) {
      setResultado(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setDecidiendo(false);
    }
  };
  const verif: VerifAcciones | null = puedeVerificar
    ? {
        onUsar: (c) => decidirNombre("aplicar", [c]),
        onMantener: (c) => decidirNombre("mantener", [c]),
        onDeshacer: (c) => decidirNombre("deshacer", [c]),
        ocupado: decidiendo,
      }
    : null;

  const acciones: Acciones = {
    onMover: (clase, p) => setDialogo({ tipo: "mover", clase, p }),
    onDesvincular: (clase, p) => setDialogo({ tipo: "desvincular", clase, p }),
  };

  const mover = async (
    clase: Clase,
    p: Persona,
    destino: DestinoSolicitado,
  ) => {
    const r = await api<{
      nombres: string;
      clase: Clase;
      rol: "titular" | "suplente";
      recintoCodigo: number;
      juntaId: string | null;
      aviso?: string;
    }>("/api/gestion/consolidado/mover", {
      method: "POST",
      body: JSON.stringify({ clase, id: p.id, destino }),
    });
    const lugar = recintos.find((x) => x.cod === r.recintoCodigo);
    await refrescar();
    setResultado(
      `${r.nombres} pasó a ${PUESTO_CLASE[r.clase]} ${r.rol}${
        r.juntaId ? ` de la junta ${etiquetaJunta(r.juntaId)}` : ""
      }${lugar ? ` en ${title(lugar.nombre)}` : ""}.${r.aviso ? ` ${r.aviso}` : ""}`,
    );
  };

  const desvincular = async (
    clase: Clase,
    p: Persona,
    motivo: string | null,
    listaNegra: boolean,
  ) => {
    await api(`${RUTA_API[clase]}/${p.id}/desvincular`, {
      method: "POST",
      body: JSON.stringify({ motivo, listaNegra }),
    });
    await refrescar();
    setResultado(
      `Se desvinculó a ${p.nombres}${listaNegra ? " y pasó a la lista negra" : ": volvió a Militancia"}.`,
    );
  };

  const enMesaInexistente = useMemo(
    () => veedoresEnMesaInexistente(veedores, recintos),
    [veedores, recintos],
  );
  const devolverAMilitancia = async (id: string) => {
    await api(`${RUTA_API.veedor}/${id}/desvincular`, {
      method: "POST",
      body: JSON.stringify({ motivo: null, listaNegra: false }),
    });
    await refrescar();
    setResultado("El veedor volvió a Militancia: asígnalo de nuevo.");
  };

  return (
    <div class="g-panel">
      <AlertaMesasInexistentes
        veedores={enMesaInexistente}
        recintos={recintos}
        onDevolver={devolverAMilitancia}
      />
      <div class="g-consol-resumen">
        <ResumenAvance
          parte={conCoordinador}
          total={base.length}
          texto={
            <>
              <strong>{conCoordinador}</strong> de{" "}
              <strong>{base.length}</strong> recintos con coordinador
            </>
          }
          etiquetaBarra="Recintos con coordinador titular"
        />
        <ResumenAvance
          parte={conCda}
          total={recintosCda.length}
          texto={
            <>
              <strong>{conCda}</strong> de <strong>{recintosCda.length}</strong>{" "}
              recintos CDA con acreditado
            </>
          }
          etiquetaBarra="Recintos CDA con acreditado titular"
        />
        <ResumenAvance
          parte={juntasConTitular}
          total={totalJuntas}
          texto={
            <>
              <strong>{juntasConTitular}</strong> de{" "}
              <strong>{totalJuntas}</strong> juntas con veedor
            </>
          }
          etiquetaBarra="Juntas con veedor titular"
        />
      </div>

      {puedeVerificar ? (
        <SincronizarIdentidad
          pendientes={pendientes}
          coinciden={coinciden}
          costoPorConsulta={costoPorConsulta}
          hayClave={hayClave}
          onTerminar={async (mensaje) => {
            await refrescarValidaciones();
            setResultado(mensaje);
          }}
          onAplicado={async (mensaje) => {
            await Promise.all([refrescar(), refrescarValidaciones()]);
            setResultado(mensaje);
          }}
        />
      ) : null}

      <FiltrosRecintos
        parroquias={parroquias}
        ubicacion={ubicacion}
        onUbicacion={setUbicacion}
        estados={[
          { clave: "todos", etiqueta: "Todos", n: base.length },
          { clave: "completos", etiqueta: "Completos", n: completos },
          {
            clave: "casi",
            etiqueta: "Casi completos",
            n: casiCompletos,
            aviso: true,
          },
          {
            clave: "pendientes",
            etiqueta: "Con pendientes",
            n: base.length - completos,
            alerta: true,
          },
          {
            clave: "excedente",
            etiqueta: "Con excedente",
            n: conExcedente,
          },
        ]}
        estado={estado}
        onEstado={setEstado}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Recinto, persona, cédula o celular…"
        contador={`Mostrando ${visibles.length} de ${filas.length} recintos`}
        hayFiltros={hayFiltros}
        onQuitar={quitarFiltros}
      />

      <div class="g-selects g-consol-filtro-identidad">
        <label>
          Identidad
          <select
            value={filtroIdentidad}
            onChange={(e) =>
              setFiltroIdentidad(
                (e.currentTarget as HTMLSelectElement).value as FiltroIdentidad,
              )
            }
          >
            <option value="todas">Todas</option>
            <option value="sinconsultar">Sin verificar</option>
            <option value="coincide">Coinciden con el oficial</option>
            <option value="revisar">Nombre por revisar</option>
            <option value="verificada">Verificadas</option>
            <option value="problema">No encontradas o cédula inválida</option>
          </select>
        </label>
      </div>

      {resultado ? (
        <p class="g-mil-resultado" role="status">
          {resultado}
        </p>
      ) : null}

      {grupos.length === 0 ? (
        <VacioFiltros
          mensaje="Ningún recinto coincide con estos filtros."
          onQuitar={quitarFiltros}
        />
      ) : (
        grupos.map((g) => {
          const completosGrupo = g.items.filter((f) => f.completo).length;
          return (
            <GrupoParroquia
              key={g.parroquia?.properties.code ?? "sin-parroquia"}
              parroquia={g.parroquia}
              busqueda={busqueda}
              cuenta={`${completosGrupo} de ${g.items.length} completos`}
            >
              <div class="g-grupo-cuerpo">
                {g.items.map((f) => {
                  const abierto = estaAbierto(f.recinto.cod);
                  return (
                    <details
                      class="g-recinto"
                      key={f.recinto.cod}
                      open={abierto}
                      onToggle={(e) =>
                        alternar(
                          f.recinto.cod,
                          (e.currentTarget as HTMLDetailsElement).open,
                        )
                      }
                    >
                      <summary>
                        <span class="g-grupo-nombre">
                          <Resaltado
                            texto={title(f.recinto.nombre)}
                            consulta={busqueda}
                          />
                        </span>
                        <span class="g-consol-estados">
                          <span
                            class={`chip-estado ${f.coordinador.titular ? "chip-estado-ok" : "chip-estado-pendiente"}`}
                          >
                            Coordinador
                          </span>
                          {f.cda ? (
                            <span
                              class={`chip-estado ${f.cda.titular ? "chip-estado-ok" : "chip-estado-pendiente"}`}
                            >
                              CDA
                            </span>
                          ) : null}
                          <span
                            class={`chip-estado ${
                              f.juntasConTitular === f.juntas.length
                                ? "chip-estado-ok"
                                : f.casiCompleto
                                  ? "chip-estado-casi"
                                  : "chip-estado-pendiente"
                            }`}
                            title={
                              [
                                f.casiCompleto
                                  ? "Casi completo: falta 1 veedor titular"
                                  : null,
                                f.excedente > 0
                                  ? `${f.veedoresTotal} veedores para ${f.juntas.length} juntas: ${f.excedente} de más`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(". ") || undefined
                            }
                          >
                            Juntas{" "}
                            {f.excedente > 0
                              ? f.veedoresTotal
                              : f.juntasConTitular}
                            /{f.juntas.length}
                            {f.casiCompleto ? (
                              <span class="g-sr-only"> (falta 1 veedor)</span>
                            ) : null}
                            {f.excedente > 0 ? (
                              <span class="g-sr-only">
                                {" "}
                                ({f.excedente} de más)
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </summary>
                      {abierto ? (
                        <div class="g-consol-detalle">
                          <section>
                            <h4>Coordinador</h4>
                            <PuestoLineas
                              clase="coordinador"
                              busqueda={busqueda}
                              identidad={identidad}
                              verif={verif}
                              acciones={acciones}
                              nombreLider={nombreLider}
                              puesto={f.coordinador}
                              falta="Sin coordinador titular"
                            />
                          </section>
                          {f.cda ? (
                            <section>
                              <h4>Acreditado CDA</h4>
                              <PuestoLineas
                                clase="cda"
                                busqueda={busqueda}
                                identidad={identidad}
                                verif={verif}
                                acciones={acciones}
                                nombreLider={nombreLider}
                                puesto={f.cda}
                                falta="Sin acreditado titular"
                              />
                            </section>
                          ) : null}
                          <section>
                            <h4>Veedores por junta</h4>
                            <ul class="g-consol-juntas">
                              {f.juntas.map((j) => (
                                <li key={j.junta.id}>
                                  <span class="g-consol-junta">
                                    {j.junta.genero}
                                    {j.junta.numero}
                                  </span>
                                  <div class="g-consol-junta-cuerpo">
                                    <PuestoLineas
                                      clase="veedor"
                                      busqueda={busqueda}
                                      identidad={identidad}
                                      verif={verif}
                                      acciones={acciones}
                                      nombreLider={nombreLider}
                                      puesto={j.puesto}
                                      falta="Sin veedor titular"
                                    />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </section>
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

      {dialogo?.tipo === "mover" ? (
        <DialogoMover
          persona={{
            id: dialogo.p.id,
            cedula: dialogo.p.cedula,
            nombres: dialogo.p.nombres,
            clase: dialogo.clase,
            tipo: dialogo.p.tipo,
            recintoCodigo: dialogo.p.recintoCodigo,
            juntaId: dialogo.p.juntaId ?? null,
          }}
          recintos={recintos}
          parroquias={parroquias}
          estado={{ veedores, coordinadores, acreditados }}
          onMover={(destino) => mover(dialogo.clase, dialogo.p, destino)}
          onCerrar={() => setDialogo(null)}
        />
      ) : null}
      {dialogo?.tipo === "desvincular" ? (
        <DialogoDesvincular
          nombres={dialogo.p.nombres}
          onConfirm={(motivo, listaNegra) =>
            desvincular(dialogo.clase, dialogo.p, motivo, listaNegra)
          }
          onCerrar={() => setDialogo(null)}
        />
      ) : null}
    </div>
  );
}
