import { useMemo, useState } from "preact/hooks";
import AsignacionCard from "./AsignacionCard";
import { title } from "../../lib/format";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { AcreditadoCda, Lider } from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaFeature[];
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

export default function GestionAcreditadosCda({
  parroquias,
  recintosCda,
  lideres,
  acreditadosIniciales,
}: Props) {
  const [acreditados, setAcreditados] = useState(acreditadosIniciales);
  const [parroquiaCod, setParroquiaCod] = useState<number | "">("");
  const [recintoCod, setRecintoCod] = useState<number | "">("");

  const parroquiasConCda = useMemo(() => {
    const codigos = new Set(recintosCda.map((r) => r.par));
    return parroquias
      .filter((p) => codigos.has(p.properties.code))
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
  }, [parroquias, recintosCda]);

  const recintosDeParroquia = useMemo(
    () =>
      recintosCda
        .filter((r) => r.par === parroquiaCod)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [recintosCda, parroquiaCod],
  );
  const recinto = recintosCda.find((r) => r.cod === recintoCod) ?? null;

  const refrescar = async () => {
    setAcreditados(await api<AcreditadoCda[]>("/api/gestion/acreditados-cda"));
  };

  const delRecinto = recinto
    ? acreditados.filter((a) => a.recintoCodigo === recinto.cod)
    : [];
  const titular = delRecinto.find((a) => a.tipo === "titular") ?? null;
  const suplentes = delRecinto
    .filter((a) => a.tipo === "suplente")
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
            {parroquiasConCda.map((p) => (
              <option key={p.properties.code} value={p.properties.code}>
                {p.properties.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Recinto CDA
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

      {parroquiaCod && recintosDeParroquia.length === 0 ? (
        <p class="g-empty">Esta parroquia no tiene recintos CDA.</p>
      ) : !recinto ? (
        <p class="g-empty">Elige una parroquia y un recinto CDA.</p>
      ) : (
        <div class="g-cards">
          <AsignacionCard
            titulo={`Acreditado CDA de ${title(recinto.nombre)}`}
            titular={titular}
            suplentes={suplentes}
            lideres={lideres}
            onAgregarTitular={async (input) => {
              await api("/api/gestion/acreditados-cda", {
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
              await api("/api/gestion/acreditados-cda", {
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
              await api(`/api/gestion/acreditados-cda/${id}/desvincular`, {
                method: "POST",
                body: JSON.stringify({ motivo, listaNegra }),
              });
              await refrescar();
            }}
            onVerificar={async (id, verificado) => {
              await api(`/api/gestion/acreditados-cda/${id}/verificar`, {
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
