import { useMemo, useState } from "preact/hooks";
import AsignacionCard from "./AsignacionCard";
import { normalizar, title } from "../../lib/format";
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

type TipoParroquia = "todas" | "urbanas" | "rurales";
type Estado = "todos" | "con" | "sin";

const TIPOS: { clave: TipoParroquia; etiqueta: string }[] = [
  { clave: "todas", etiqueta: "Todas" },
  { clave: "urbanas", etiqueta: "Urbanas" },
  { clave: "rurales", etiqueta: "Rurales" },
];

export default function GestionCoordinadores({
  parroquias,
  recintos,
  lideres,
  coordinadoresIniciales,
}: Props) {
  const [coordinadores, setCoordinadores] = useState(coordinadoresIniciales);
  const [tipo, setTipo] = useState<TipoParroquia>("todas");
  const [parroquiaCod, setParroquiaCod] = useState<number | "">("");
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

  const esDelTipo = (urbana: boolean | undefined) =>
    tipo === "todas" || urbana === (tipo === "urbanas");

  // Parroquias que ofrece el selector según el tipo elegido.
  const parroquiasDelTipo = useMemo(
    () =>
      parroquias
        .filter((p) => esDelTipo(p.properties.urbana))
        .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
    [parroquias, tipo],
  );

  // Recintos tras tipo de parroquia, parroquia y búsqueda (los conteos de los
  // chips de estado salen de aquí).
  const base = useMemo(() => {
    const q = normalizar(busqueda);
    return filas.filter((f) => {
      if (!esDelTipo(f.parroquia?.properties.urbana)) return false;
      if (parroquiaCod !== "" && f.recinto.par !== parroquiaCod) return false;
      if (q) {
        const texto = normalizar(
          [
            f.recinto.nombre,
            f.parroquia?.properties.name ?? "",
            f.titular?.nombres,
            f.titular?.cedula,
            ...f.suplentes.map((s) => `${s.nombres} ${s.cedula}`),
          ].join(" "),
        );
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [filas, tipo, parroquiaCod, busqueda]);

  const conTitular = base.filter((f) => f.titular).length;
  const visibles = base.filter((f) =>
    estado === "con" ? f.titular : estado === "sin" ? !f.titular : true,
  );

  // Agrupadas por parroquia, en orden alfabético.
  const grupos = useMemo(() => {
    const mapa = new Map<number, typeof visibles>();
    for (const f of visibles) {
      mapa.set(f.recinto.par, [...(mapa.get(f.recinto.par) ?? []), f]);
    }
    return [...mapa.entries()]
      .map(([cod, items]) => ({
        parroquia: parroquias.find((p) => p.properties.code === cod),
        items: items.sort((a, b) =>
          a.recinto.nombre.localeCompare(b.recinto.nombre),
        ),
      }))
      .sort((a, b) =>
        (a.parroquia?.properties.name ?? "").localeCompare(
          b.parroquia?.properties.name ?? "",
        ),
      );
  }, [visibles, parroquias]);

  const hayFiltros =
    tipo !== "todas" ||
    parroquiaCod !== "" ||
    estado !== "todos" ||
    busqueda !== "";
  const quitarFiltros = () => {
    setTipo("todas");
    setParroquiaCod("");
    setEstado("todos");
    setBusqueda("");
  };

  const chipsEstado: { clave: Estado; etiqueta: string; n: number }[] = [
    { clave: "todos", etiqueta: "Todos", n: base.length },
    { clave: "con", etiqueta: "Con coordinador", n: conTitular },
    { clave: "sin", etiqueta: "Sin coordinador", n: base.length - conTitular },
  ];

  const pct =
    base.length > 0 ? Math.round((conTitular / base.length) * 100) : 0;

  return (
    <div class="g-panel g-coor">
      <div class="g-coor-resumen">
        <p>
          <strong>{conTitular}</strong> de <strong>{base.length}</strong>{" "}
          recintos tienen coordinador titular ({pct}%)
        </p>
        <div
          class="g-coor-barra"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Recintos con coordinador titular"
        >
          <div class="g-coor-barra-lleno" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div class="g-mil-filtros">
        <div class="g-mil-chips" role="group" aria-label="Tipo de parroquia">
          {TIPOS.map((t) => (
            <button
              key={t.clave}
              type="button"
              class="g-chip-filtro"
              aria-pressed={tipo === t.clave}
              onClick={() => {
                setTipo(t.clave);
                // Si la parroquia elegida ya no es del tipo, se quita.
                const sel = parroquias.find(
                  (p) => p.properties.code === parroquiaCod,
                );
                if (
                  sel &&
                  t.clave !== "todas" &&
                  sel.properties.urbana !== (t.clave === "urbanas")
                ) {
                  setParroquiaCod("");
                }
              }}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
        <div class="g-mil-chips" role="group" aria-label="Estado">
          {chipsEstado.map((c) => (
            <button
              key={c.clave}
              type="button"
              class="g-chip-filtro"
              aria-pressed={estado === c.clave}
              data-alerta={c.clave === "sin" && c.n > 0 ? "true" : undefined}
              onClick={() => setEstado(c.clave)}
            >
              {c.etiqueta}
              <span class="g-chip-filtro-n">{c.n}</span>
            </button>
          ))}
        </div>
        <div class="g-mil-buscar">
          <label>
            Parroquia
            <select
              value={parroquiaCod}
              onChange={(e) =>
                setParroquiaCod(
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
                )
              }
            >
              <option value="">Todas</option>
              {parroquiasDelTipo.map((p) => (
                <option key={p.properties.code} value={p.properties.code}>
                  {p.properties.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input
              type="search"
              value={busqueda}
              placeholder="Recinto, coordinador o cédula…"
              onInput={(e) =>
                setBusqueda((e.currentTarget as HTMLInputElement).value)
              }
            />
          </label>
        </div>
      </div>

      <p class="g-mil-contador" aria-live="polite">
        {`Mostrando ${visibles.length} de ${filas.length} recintos`}
        {hayFiltros ? (
          <>
            {" · "}
            <button type="button" class="g-btn-link" onClick={quitarFiltros}>
              Quitar filtros
            </button>
          </>
        ) : null}
      </p>

      {grupos.length === 0 ? (
        <div class="g-mil-vacio">
          <p>
            <strong>Ningún recinto coincide con estos filtros.</strong>
          </p>
          <button type="button" class="g-btn-ghost" onClick={quitarFiltros}>
            Quitar filtros
          </button>
        </div>
      ) : (
        grupos.map((g) => {
          const nombre = g.parroquia?.properties.name ?? "Sin parroquia";
          const con = g.items.filter((f) => f.titular).length;
          return (
            <details
              class="g-coor-grupo"
              key={g.parroquia?.properties.code ?? nombre}
              open
            >
              <summary>
                <span class="g-coor-grupo-nombre">{nombre}</span>
                <span class="chip-estado chip-estado-sin">
                  {g.parroquia?.properties.urbana ? "Urbana" : "Rural"}
                </span>
                <span class="g-coor-grupo-cuenta">
                  {con} de {g.items.length} con coordinador
                </span>
              </summary>
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
            </details>
          );
        })
      )}
    </div>
  );
}
