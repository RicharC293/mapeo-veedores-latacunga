import { useMemo, useState } from "preact/hooks";
import AsignacionCard from "./AsignacionCard";
import { title } from "../../lib/format";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { Coordinador, Lider } from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaFeature[];
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

export default function GestionCoordinadores({
  parroquias,
  recintos,
  lideres,
  coordinadoresIniciales,
}: Props) {
  const [coordinadores, setCoordinadores] = useState(coordinadoresIniciales);
  const [parroquiaCod, setParroquiaCod] = useState<number | "">("");
  const [recintoCod, setRecintoCod] = useState<number | "">("");

  const recintosDeParroquia = useMemo(
    () =>
      recintos
        .filter((r) => r.par === parroquiaCod)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [recintos, parroquiaCod],
  );
  const recinto = recintos.find((r) => r.cod === recintoCod) ?? null;

  const refrescar = async () => {
    setCoordinadores(await api<Coordinador[]>("/api/gestion/coordinadores"));
  };

  const delRecinto = recinto
    ? coordinadores.filter((c) => c.recintoCodigo === recinto.cod)
    : [];
  const titular = delRecinto.find((c) => c.tipo === "titular") ?? null;
  const suplentes = delRecinto
    .filter((c) => c.tipo === "suplente")
    .sort((a, b) => a.orden - b.orden);

  return (
    <div class="g-panel">
      <div class="g-selects">
        <label>
          Parroquia
          <select
            value={parroquiaCod}
            onChange={(e) => {
              setParroquiaCod(
                Number((e.currentTarget as HTMLSelectElement).value) || "",
              );
              setRecintoCod("");
            }}
          >
            <option value="">Selecciona…</option>
            {parroquias
              .slice()
              .sort((a, b) =>
                a.properties.name.localeCompare(b.properties.name),
              )
              .map((p) => (
                <option key={p.properties.code} value={p.properties.code}>
                  {p.properties.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Recinto
          <select
            value={recintoCod}
            disabled={!parroquiaCod}
            onChange={(e) =>
              setRecintoCod(
                Number((e.currentTarget as HTMLSelectElement).value) || "",
              )
            }
          >
            <option value="">Selecciona…</option>
            {recintosDeParroquia.map((r) => (
              <option key={r.cod} value={r.cod}>
                {title(r.nombre)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!recinto ? (
        <p class="g-empty">Elige una parroquia y un recinto.</p>
      ) : (
        <div class="g-cards">
          <AsignacionCard
            titulo={`Coordinador de ${title(recinto.nombre)}`}
            titular={titular}
            suplentes={suplentes}
            lideres={lideres}
            onAgregarTitular={async (input) => {
              await api("/api/gestion/coordinadores", {
                method: "POST",
                body: JSON.stringify({
                  ...input,
                  recintoCodigo: recinto.cod,
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
                  recintoCodigo: recinto.cod,
                  tipo: "suplente",
                }),
              });
              await refrescar();
            }}
            onDesvincular={async (id, motivo, listaNegra) => {
              await api(`/api/gestion/coordinadores/${id}/desvincular`, {
                method: "POST",
                body: JSON.stringify({ motivo, listaNegra }),
              });
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
        </div>
      )}
    </div>
  );
}
