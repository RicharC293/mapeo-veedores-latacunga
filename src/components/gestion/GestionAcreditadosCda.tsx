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
import type { AcreditadoCda, Lider } from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaBasica[];
  recintosCda: Recinto[];
  lideres: Lider[];
  acreditadosIniciales: AcreditadoCda[];
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

export default function GestionAcreditadosCda({
  parroquias,
  recintosCda,
  lideres,
  acreditadosIniciales,
}: Props) {
  const [acreditados, setAcreditados] = useState(acreditadosIniciales);
  const [ubicacion, setUbicacion] = useState<Ubicacion>("todas");
  const [estado, setEstado] = useState<Estado>("todos");
  const [busqueda, setBusqueda] = useState("");

  const refrescar = async () => {
    setAcreditados(await api<AcreditadoCda[]>("/api/gestion/acreditados-cda"));
  };

  // El selector solo ofrece parroquias que tienen algún recinto CDA.
  const parroquiasConCda = useMemo(() => {
    const codigos = new Set(recintosCda.map((r) => r.par));
    return parroquias.filter((p) => codigos.has(p.properties.code));
  }, [parroquias, recintosCda]);

  // Un registro por recinto CDA, con su acreditado titular y sus suplentes.
  const filas = useMemo(() => {
    const porRecinto = new Map<number, AcreditadoCda[]>();
    for (const a of acreditados) {
      porRecinto.set(a.recintoCodigo, [
        ...(porRecinto.get(a.recintoCodigo) ?? []),
        a,
      ]);
    }
    return recintosCda.map((recinto) => {
      const delRecinto = porRecinto.get(recinto.cod) ?? [];
      return {
        recinto,
        parroquia: parroquias.find((p) => p.properties.code === recinto.par),
        titular: delRecinto.find((a) => a.tipo === "titular") ?? null,
        suplentes: delRecinto
          .filter((a) => a.tipo === "suplente")
          .sort((a, b) => a.orden - b.orden),
      };
    });
  }, [acreditados, recintosCda, parroquias]);

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
            recintos CDA tienen acreditado titular
          </>
        }
        etiquetaBarra="Recintos CDA con acreditado titular"
      />

      <FiltrosRecintos
        parroquias={parroquiasConCda}
        ubicacion={ubicacion}
        onUbicacion={setUbicacion}
        estados={[
          { clave: "todos", etiqueta: "Todos", n: base.length },
          { clave: "con", etiqueta: "Con acreditado", n: conTitular },
          {
            clave: "sin",
            etiqueta: "Sin acreditado",
            n: base.length - conTitular,
            alerta: true,
          },
        ]}
        estado={estado}
        onEstado={setEstado}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Recinto, acreditado o cédula…"
        contador={`Mostrando ${visibles.length} de ${filas.length} recintos CDA`}
        hayFiltros={hayFiltros}
        onQuitar={quitarFiltros}
      />

      {grupos.length === 0 ? (
        <VacioFiltros
          mensaje="Ningún recinto CDA coincide con estos filtros."
          onQuitar={quitarFiltros}
        />
      ) : (
        grupos.map((g) => {
          const con = g.items.filter((f) => f.titular).length;
          return (
            <GrupoParroquia
              key={g.parroquia?.properties.code ?? "sin-parroquia"}
              parroquia={g.parroquia}
              cuenta={`${con} de ${g.items.length} con acreditado`}
            >
              <div class="g-cards">
                {g.items.map((f) => (
                  <AsignacionCard
                    key={f.recinto.cod}
                    titulo={`Acreditado CDA de ${title(f.recinto.nombre)}`}
                    titular={f.titular}
                    suplentes={f.suplentes}
                    lideres={lideres}
                    onAgregarTitular={async (input) => {
                      await api("/api/gestion/acreditados-cda", {
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
                      await api("/api/gestion/acreditados-cda", {
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
                        `/api/gestion/acreditados-cda/${id}/desvincular`,
                        {
                          method: "POST",
                          body: JSON.stringify({ motivo, listaNegra }),
                        },
                      );
                      await refrescar();
                    }}
                    onVerificar={async (id, verificado) => {
                      await api(
                        `/api/gestion/acreditados-cda/${id}/verificar`,
                        {
                          method: "POST",
                          body: JSON.stringify({ verificado }),
                        },
                      );
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
