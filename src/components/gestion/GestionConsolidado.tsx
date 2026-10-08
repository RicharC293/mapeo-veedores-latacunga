import { useMemo, useState } from "preact/hooks";
import FiltrosRecintos, {
  ResumenAvance,
  VacioFiltros,
} from "./FiltrosRecintos";
import BotonIcono from "./BotonIcono";
import DialogoDesvincular from "./DialogoDesvincular";
import DialogoMover from "./DialogoMover";
import GrupoParroquia from "./GrupoParroquia";
import Iniciales from "./Iniciales";
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
}

type Estado = "todos" | "completos" | "pendientes";

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

function Linea({
  p,
  rol,
  clase,
  nombreLider,
  acciones,
}: {
  p: Persona;
  rol: "titular" | "suplente";
  clase: Clase;
  nombreLider: Map<string, string>;
  acciones: Acciones;
}) {
  const responsable = p.responsableLiderId
    ? nombreLider.get(p.responsableLiderId)
    : undefined;
  return (
    <div class="g-consol-persona">
      <Iniciales nombres={p.nombres} rol={rol} />
      <div class="g-consol-persona-texto">
        <strong>{p.nombres}</strong>
        <small>
          CI {p.cedula}
          {p.telefono ? ` · ${p.telefono}` : ""}
          {p.email ? ` · ${p.email}` : ""}
          {responsable ? ` · ${responsable}` : ""}
        </small>
        {p.preferencia ? (
          <small class="g-persona-pref">Preferencia: {p.preferencia}</small>
        ) : null}
        {p.verificado ? (
          <span class="chip-estado chip-estado-ok">Verificado</span>
        ) : null}
      </div>
      <div class="g-consol-acciones">
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
  puesto,
  falta,
  clase,
  nombreLider,
  acciones,
}: {
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
}: Props) {
  const [veedores, setVeedores] = useState(veedoresIniciales);
  const [coordinadores, setCoordinadores] = useState(coordinadoresIniciales);
  const [acreditados, setAcreditados] = useState(acreditadosIniciales);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("todas");
  const [estado, setEstado] = useState<Estado>("todos");
  const [busqueda, setBusqueda] = useState("");

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
  const visibles = base.filter((f) =>
    estado === "completos"
      ? f.completo
      : estado === "pendientes"
        ? !f.completo
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
    ubicacion !== "todas" || estado !== "todos" || busqueda !== "";
  const quitarFiltros = () => {
    setUbicacion("todas");
    setEstado("todos");
    setBusqueda("");
  };
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

  return (
    <div class="g-panel">
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

      <FiltrosRecintos
        parroquias={parroquias}
        ubicacion={ubicacion}
        onUbicacion={setUbicacion}
        estados={[
          { clave: "todos", etiqueta: "Todos", n: base.length },
          { clave: "completos", etiqueta: "Completos", n: completos },
          {
            clave: "pendientes",
            etiqueta: "Con pendientes",
            n: base.length - completos,
            alerta: true,
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
                          {title(f.recinto.nombre)}
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
                            class={`chip-estado ${f.juntasConTitular === f.juntas.length ? "chip-estado-ok" : "chip-estado-pendiente"}`}
                          >
                            Juntas {f.juntasConTitular}/{f.juntas.length}
                          </span>
                        </span>
                      </summary>
                      {abierto ? (
                        <div class="g-consol-detalle">
                          <section>
                            <h4>Coordinador</h4>
                            <PuestoLineas
                              clase="coordinador"
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
