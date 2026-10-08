import { useMemo, useState } from "preact/hooks";
import AsignacionCard from "./AsignacionCard";
import FiltrosRecintos, {
  ResumenAvance,
  VacioFiltros,
} from "./FiltrosRecintos";
import GrupoParroquia from "./GrupoParroquia";
import { normalizar, title } from "../../lib/format";
import {
  agruparPorParroquia,
  coincideUbicacion,
  type Ubicacion,
} from "../../lib/gestion/ubicacion";
import type { ParroquiaBasica, Recinto } from "../../lib/types";
import type { Coordinador, Lider } from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaBasica[];
  recintos: Recinto[];
  lideres: Lider[];
  coordinadoresIniciales: Coordinador[];
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

type Estado = "todos" | "con" | "sin";

export default function GestionCoordinadores({
  parroquias,
  recintos,
  lideres,
  coordinadoresIniciales,
}: Props) {
  const [coordinadores, setCoordinadores] = useState(coordinadoresIniciales);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("todas");
  const [estado, setEstado] = useState<Estado>("todos");
  const [busqueda, setBusqueda] = useState("");

  const refrescar = async () => {
    setCoordinadores(await api<Coordinador[]>("/api/gestion/coordinadores"));
  };

  // Un registro por recinto, con su coordinador titular y sus suplentes.
  const filas = useMemo(() => {
    const porRecinto = new Map<number, Coordinador[]>();
    for (const c of coordinadores) {
      porRecinto.set(c.recintoCodigo, [
        ...(porRecinto.get(c.recintoCodigo) ?? []),
        c,
      ]);
    }
    return recintos.map((recinto) => {
      const delRecinto = porRecinto.get(recinto.cod) ?? [];
      return {
        recinto,
        parroquia: parroquias.find((p) => p.properties.code === recinto.par),
        titular: delRecinto.find((c) => c.tipo === "titular") ?? null,
        suplentes: delRecinto
          .filter((c) => c.tipo === "suplente")
          .sort((a, b) => a.orden - b.orden),
      };
    });
  }, [coordinadores, recintos, parroquias]);

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
          f.titular?.nombres,
          f.titular?.cedula,
          ...f.suplentes.map((s) => `${s.nombres} ${s.cedula}`),
        ].join(" "),
      ).includes(q);
    });
  }, [filas, ubicacion, busqueda]);

  const conTitular = base.filter((f) => f.titular).length;
  const visibles = base.filter((f) =>
    estado === "con" ? f.titular : estado === "sin" ? !f.titular : true,
  );
  const grupos = useMemo(
    () => agruparPorParroquia(visibles, parroquias),
    [visibles, parroquias],
  );

  const hayFiltros =
    ubicacion !== "todas" || estado !== "todos" || busqueda !== "";
  const quitarFiltros = () => {
    setUbicacion("todas");
    setEstado("todos");
    setBusqueda("");
  };

  return (
    <div class="g-panel">
      <ResumenAvance
        parte={conTitular}
        total={base.length}
        texto={
          <>
            <strong>{conTitular}</strong> de <strong>{base.length}</strong>{" "}
            recintos tienen coordinador titular
          </>
        }
        etiquetaBarra="Recintos con coordinador titular"
      />

      <FiltrosRecintos
        parroquias={parroquias}
        ubicacion={ubicacion}
        onUbicacion={setUbicacion}
        estados={[
          { clave: "todos", etiqueta: "Todos", n: base.length },
          { clave: "con", etiqueta: "Con coordinador", n: conTitular },
          {
            clave: "sin",
            etiqueta: "Sin coordinador",
            n: base.length - conTitular,
            alerta: true,
          },
        ]}
        estado={estado}
        onEstado={setEstado}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Recinto, coordinador o cédula…"
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
          const con = g.items.filter((f) => f.titular).length;
          return (
            <GrupoParroquia
              key={g.parroquia?.properties.code ?? "sin-parroquia"}
              parroquia={g.parroquia}
              cuenta={`${con} de ${g.items.length} con coordinador`}
            >
              <div class="g-cards">
                {g.items.map((f) => (
                  <AsignacionCard
                    key={f.recinto.cod}
                    titulo={title(f.recinto.nombre)}
                    titular={f.titular}
                    suplentes={f.suplentes}
                    lideres={lideres}
                    onAgregarTitular={async (input) => {
                      await api("/api/gestion/coordinadores", {
                        method: "POST",
                        body: JSON.stringify({
                          ...input,
                          recintoCodigo: f.recinto.cod,
                          tipo: "titular",
                        }),
                      });
                      await refrescar();
                    }}
                    onAgregarSuplente={async (input) => {
                      await api("/api/gestion/coordinadores", {
                        method: "POST",
                        body: JSON.stringify({
                          ...input,
                          recintoCodigo: f.recinto.cod,
                          tipo: "suplente",
                        }),
                      });
                      await refrescar();
                    }}
                    onDesvincular={async (id, motivo, listaNegra) => {
                      await api(
                        `/api/gestion/coordinadores/${id}/desvincular`,
                        {
                          method: "POST",
                          body: JSON.stringify({ motivo, listaNegra }),
                        },
                      );
                      await refrescar();
                    }}
                    onVerificar={async (id, verificado) => {
                      await api(`/api/gestion/coordinadores/${id}/verificar`, {
                        method: "POST",
                        body: JSON.stringify({ verificado }),
                      });
                      await refrescar();
                    }}
                  />
                ))}
              </div>
            </GrupoParroquia>
          );
        })
      )}
    </div>
  );
}
