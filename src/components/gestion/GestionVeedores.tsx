import { useMemo, useState } from "preact/hooks";
import AsignacionCard from "./AsignacionCard";
import { listJuntasDeRecinto } from "../../lib/gestion/juntas";
import { title } from "../../lib/format";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { Veedor } from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
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

export default function GestionVeedores({
  parroquias,
  recintos,
  veedoresIniciales,
}: Props) {
  const [veedores, setVeedores] = useState(veedoresIniciales);
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
  const juntas = useMemo(
    () => (recinto ? listJuntasDeRecinto(recinto) : []),
    [recinto],
  );

  const refrescar = async () => {
    setVeedores(await api<Veedor[]>("/api/gestion/veedores"));
  };

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
        <p class="g-empty">
          Elige una parroquia y un recinto para ver sus juntas.
        </p>
      ) : (
        <div class="g-cards">
          {juntas.map((junta) => {
            const deLaJunta = veedores.filter((v) => v.juntaId === junta.id);
            const tit = deLaJunta.find((v) => v.tipo === "titular") ?? null;
            const sup = deLaJunta
              .filter((v) => v.tipo === "suplente")
              .sort((a, b) => a.orden - b.orden);
            return (
              <AsignacionCard
                key={junta.id}
                titulo={`Junta ${junta.genero}${junta.numero}`}
                titular={tit}
                suplentes={sup}
                onAgregarTitular={async (input) => {
                  await api("/api/gestion/veedores", {
                    method: "POST",
                    body: JSON.stringify({
                      ...input,
                      recintoCodigo: recinto.cod,
                      genero: junta.genero,
                      numero: junta.numero,
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
                      recintoCodigo: recinto.cod,
                      genero: junta.genero,
                      numero: junta.numero,
                      tipo: "suplente",
                    }),
                  });
                  await refrescar();
                }}
                onDesvincular={async (id, motivo) => {
                  await api(`/api/gestion/veedores/${id}/desvincular`, {
                    method: "POST",
                    body: JSON.stringify({ motivo }),
                  });
                  await refrescar();
                }}
                onVerificar={async (id, verificado) => {
                  await api(`/api/gestion/veedores/${id}/verificar`, {
                    method: "POST",
                    body: JSON.stringify({ verificado }),
                  });
                  await refrescar();
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
