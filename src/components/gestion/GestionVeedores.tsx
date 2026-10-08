import { useMemo, useState } from "preact/hooks";
import AsignacionCard from "./AsignacionCard";
import FiltrosRecintos, {
  ResumenAvance,
  VacioFiltros,
} from "./FiltrosRecintos";
import GrupoParroquia from "./GrupoParroquia";
import { listJuntasDeRecinto } from "../../lib/gestion/juntas";
import { normalizar, title } from "../../lib/format";
import {
  agruparPorParroquia,
  coincideUbicacion,
  type Ubicacion,
} from "../../lib/gestion/ubicacion";
import type { ParroquiaBasica, Recinto } from "../../lib/types";
import type { Lider, Veedor } from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaBasica[];
  recintos: Recinto[];
  lideres: Lider[];
  veedoresIniciales: Veedor[];
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as T;
}

type Estado = "todos" | "incompletos" | "completos";

// Con pocos recintos a la vista, sus juntas se muestran abiertas.
const ABRIR_SI_HAY_HASTA = 2;

export default function GestionVeedores({
  parroquias,
  recintos,
  lideres,
  veedoresIniciales,
}: Props) {
  const [veedores, setVeedores] = useState(veedoresIniciales);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("todas");
  const [estado, setEstado] = useState<Estado>("todos");
  const [busqueda, setBusqueda] = useState("");
  // Lo que la persona abrió o cerró a mano; lo demás sigue la regla por defecto.
  const [eleccion, setEleccion] = useState<Map<number, boolean>>(new Map());

  const refrescar = async () => {
    setVeedores(await api<Veedor[]>("/api/gestion/veedores"));
  };

  // Un registro por recinto: sus juntas y cuántas ya tienen veedor titular.
  const filas = useMemo(() => {
    const porRecinto = new Map<number, Veedor[]>();
    for (const v of veedores) {
      porRecinto.set(v.recintoCodigo, [
        ...(porRecinto.get(v.recintoCodigo) ?? []),
        v,
      ]);
    }
    return recintos.map((recinto) => {
      const delRecinto = porRecinto.get(recinto.cod) ?? [];
      const juntas = listJuntasDeRecinto(recinto);
      const conTitular = juntas.filter((j) =>
        delRecinto.some((v) => v.juntaId === j.id && v.tipo === "titular"),
      ).length;
      return {
        recinto,
        parroquia: parroquias.find((p) => p.properties.code === recinto.par),
        juntas,
        delRecinto,
        conTitular,
      };
    });
  }, [veedores, recintos, parroquias]);

  // Recintos tras ubicación y búsqueda (los conteos de los chips de estado
  // salen de aquí).
  const base = useMemo(() => {
    const q = normalizar(busqueda);
    return filas.filter((f) => {
      if (!coincideUbicacion(ubicacion, f.parroquia)) return false;
      if (!q) return true;
      return normalizar(
        [
          f.recinto.nombre,
          f.parroquia?.properties.name ?? "",
          ...f.delRecinto.map((v) => `${v.nombres} ${v.cedula}`),
        ].join(" "),
      ).includes(q);
    });
  }, [filas, ubicacion, busqueda]);

  const completo = (f: (typeof filas)[number]) =>
    f.conTitular === f.juntas.length;
  const completos = base.filter(completo).length;
  const visibles = base.filter((f) =>
    estado === "completos"
      ? completo(f)
      : estado === "incompletos"
        ? !completo(f)
        : true,
  );
  const grupos = useMemo(
    () => agruparPorParroquia(visibles, parroquias),
    [visibles, parroquias],
  );

  const totalJuntas = base.reduce((a, f) => a + f.juntas.length, 0);
  const juntasConTitular = base.reduce((a, f) => a + f.conTitular, 0);

  const hayFiltros =
    ubicacion !== "todas" || estado !== "todos" || busqueda !== "";
  const quitarFiltros = () => {
    setUbicacion("todas");
    setEstado("todos");
    setBusqueda("");
  };
  const abrirPorDefecto = visibles.length <= ABRIR_SI_HAY_HASTA;

  const estaAbierto = (cod: number) => eleccion.get(cod) ?? abrirPorDefecto;
  // El navegador también dispara "toggle" cuando el cambio lo hace la propia
  // pantalla; solo cuenta como elección si difiere de lo que ya se muestra.
  const alternar = (cod: number, abierto: boolean) => {
    if (abierto === estaAbierto(cod)) return;
    setEleccion((prev) => new Map(prev).set(cod, abierto));
  };

  return (
    <div class="g-panel">
      <ResumenAvance
        parte={juntasConTitular}
        total={totalJuntas}
        texto={
          <>
            <strong>{juntasConTitular}</strong> de{" "}
            <strong>{totalJuntas}</strong> juntas tienen veedor titular
          </>
        }
        etiquetaBarra="Juntas con veedor titular"
      />

      <FiltrosRecintos
        parroquias={parroquias}
        ubicacion={ubicacion}
        onUbicacion={setUbicacion}
        estados={[
          { clave: "todos", etiqueta: "Todos", n: base.length },
          {
            clave: "incompletos",
            etiqueta: "Con juntas sin veedor",
            n: base.length - completos,
            alerta: true,
          },
          { clave: "completos", etiqueta: "Completos", n: completos },
        ]}
        estado={estado}
        onEstado={setEstado}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Recinto, veedor o cédula…"
        contador={`Mostrando ${visibles.length} de ${filas.length} recintos`}
        hayFiltros={hayFiltros}
        onQuitar={quitarFiltros}
      />

      {grupos.length === 0 ? (
        <VacioFiltros
          mensaje="Ningún recinto coincide con estos filtros."
          onQuitar={quitarFiltros}
        />
      ) : (
        grupos.map((g) => {
          const juntas = g.items.reduce((a, f) => a + f.juntas.length, 0);
          const con = g.items.reduce((a, f) => a + f.conTitular, 0);
          return (
            <GrupoParroquia
              key={g.parroquia?.properties.code ?? "sin-parroquia"}
              parroquia={g.parroquia}
              cuenta={`${con} de ${juntas} juntas con veedor`}
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
                        <span class="g-grupo-cuenta">
                          {f.conTitular} de {f.juntas.length} juntas con veedor
                        </span>
                      </summary>
                      {abierto ? (
                        <div class="g-cards">
                          {f.juntas.map((junta) => {
                            const deLaJunta = f.delRecinto.filter(
                              (v) => v.juntaId === junta.id,
                            );
                            const tit =
                              deLaJunta.find((v) => v.tipo === "titular") ??
                              null;
                            const sup = deLaJunta
                              .filter((v) => v.tipo === "suplente")
                              .sort((a, b) => a.orden - b.orden);
                            const cuerpo = {
                              recintoCodigo: f.recinto.cod,
                              genero: junta.genero,
                              numero: junta.numero,
                            };
                            return (
                              <AsignacionCard
                                key={junta.id}
                                titulo={`Junta ${junta.genero}${junta.numero}`}
                                titular={tit}
                                suplentes={sup}
                                lideres={lideres}
                                onAgregarTitular={async (input) => {
                                  await api("/api/gestion/veedores", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      ...input,
                                      ...cuerpo,
                                      tipo: "titular",
                                    }),
                                  });
                                  await refrescar();
                                }}
                                onAgregarSuplente={async (input) => {
                                  await api("/api/gestion/veedores", {
                                    method: "POST",
                                    body: JSON.stringify({
                                      ...input,
                                      ...cuerpo,
                                      tipo: "suplente",
                                    }),
                                  });
                                  await refrescar();
                                }}
                                onDesvincular={async (
                                  id,
                                  motivo,
                                  listaNegra,
                                ) => {
                                  await api(
                                    `/api/gestion/veedores/${id}/desvincular`,
                                    {
                                      method: "POST",
                                      body: JSON.stringify({
                                        motivo,
                                        listaNegra,
                                      }),
                                    },
                                  );
                                  await refrescar();
                                }}
                                onVerificar={async (id, verificado) => {
                                  await api(
                                    `/api/gestion/veedores/${id}/verificar`,
                                    {
                                      method: "POST",
                                      body: JSON.stringify({ verificado }),
                                    },
                                  );
                                  await refrescar();
                                }}
                              />
                            );
                          })}
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
