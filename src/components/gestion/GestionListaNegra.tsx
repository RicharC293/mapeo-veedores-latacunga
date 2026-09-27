import { useState } from "preact/hooks";
import type { ListaNegraEntry } from "../../lib/gestion/types";

interface Props {
  entradasIniciales: ListaNegraEntry[];
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

const origenLabel: Record<ListaNegraEntry["origen"], string> = {
  veedor: "Ex veedor",
  coordinador: "Ex coordinador",
  manual: "Agregado manualmente",
};

export default function GestionListaNegra({ entradasIniciales }: Props) {
  const [entradas, setEntradas] = useState(entradasIniciales);
  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [telefono, setTelefono] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const refrescar = async () =>
    setEntradas(await api<ListaNegraEntry[]>("/api/gestion/lista-negra"));

  const agregar = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/gestion/lista-negra", {
        method: "POST",
        body: JSON.stringify({
          cedula,
          nombres,
          telefono,
          motivo: motivo.trim() || null,
        }),
      });
      setCedula("");
      setNombres("");
      setTelefono("");
      setMotivo("");
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  const quitar = async (id: string) => {
    await api(`/api/gestion/lista-negra/${id}`, { method: "DELETE" });
    await refrescar();
  };

  return (
    <div class="g-panel">
      <form class="g-form" onSubmit={agregar}>
        <p class="g-form-title">Agregar manualmente a la lista negra</p>
        <label>
          Cédula
          <input
            value={cedula}
            onInput={(e) =>
              setCedula((e.currentTarget as HTMLInputElement).value)
            }
            inputMode="numeric"
            maxLength={10}
            required
          />
        </label>
        <label>
          Nombres y apellidos
          <input
            value={nombres}
            onInput={(e) =>
              setNombres((e.currentTarget as HTMLInputElement).value)
            }
            required
          />
        </label>
        <label>
          Teléfono
          <input
            value={telefono}
            onInput={(e) =>
              setTelefono((e.currentTarget as HTMLInputElement).value)
            }
          />
        </label>
        <label>
          Motivo (opcional)
          <textarea
            value={motivo}
            onInput={(e) =>
              setMotivo((e.currentTarget as HTMLTextAreaElement).value)
            }
            rows={2}
          />
        </label>
        {error ? <p class="g-error">{error}</p> : null}
        <div class="g-form-actions">
          <button type="submit">Agregar</button>
        </div>
      </form>

      <ul class="g-list">
        {entradas.length === 0 ? (
          <p class="g-empty">La lista negra está vacía.</p>
        ) : null}
        {entradas.map((entry) =>
          editandoId === entry.id ? (
            <li key={entry.id}>
              <EditarEntrada
                entry={entry}
                onGuardar={async (patch) => {
                  await api(`/api/gestion/lista-negra/${entry.id}`, {
                    method: "PATCH",
                    body: JSON.stringify(patch),
                  });
                  setEditandoId(null);
                  await refrescar();
                }}
                onCancelar={() => setEditandoId(null)}
              />
            </li>
          ) : (
            <li key={entry.id} class="g-persona">
              <div>
                <strong>{entry.nombres}</strong>
                <small>
                  CI {entry.cedula}
                  {entry.telefono ? ` · ${entry.telefono}` : ""} ·{" "}
                  {origenLabel[entry.origen]}
                </small>
                {entry.motivo ? <small>Motivo: {entry.motivo}</small> : null}
              </div>
              <div class="g-row-actions">
                <button
                  class="g-btn-ghost"
                  onClick={() => setEditandoId(entry.id)}
                >
                  Editar
                </button>
                <button
                  class="g-btn-danger-ghost"
                  onClick={() => quitar(entry.id)}
                >
                  Sacar de la lista negra
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function EditarEntrada({
  entry,
  onGuardar,
  onCancelar,
}: {
  entry: ListaNegraEntry;
  onGuardar: (patch: Partial<ListaNegraEntry>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombres, setNombres] = useState(entry.nombres);
  const [telefono, setTelefono] = useState(entry.telefono);
  const [motivo, setMotivo] = useState(entry.motivo ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await onGuardar({ nombres, telefono, motivo: motivo.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  return (
    <form class="g-form" onSubmit={submit}>
      <p class="g-form-title">Editar registro</p>
      <label>
        Nombres y apellidos
        <input
          value={nombres}
          onInput={(e) =>
            setNombres((e.currentTarget as HTMLInputElement).value)
          }
        />
      </label>
      <label>
        Teléfono
        <input
          value={telefono}
          onInput={(e) =>
            setTelefono((e.currentTarget as HTMLInputElement).value)
          }
        />
      </label>
      <label>
        Motivo
        <textarea
          value={motivo}
          onInput={(e) =>
            setMotivo((e.currentTarget as HTMLTextAreaElement).value)
          }
          rows={2}
        />
      </label>
      {error ? <p class="g-error">{error}</p> : null}
      <div class="g-form-actions">
        <button type="submit">Guardar cambios</button>
        <button type="button" class="g-btn-ghost" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
