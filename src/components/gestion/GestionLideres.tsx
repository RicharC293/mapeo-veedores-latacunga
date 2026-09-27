import { useMemo, useState } from "preact/hooks";
import { title } from "../../lib/format";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import type { Lider } from "../../lib/gestion/types";

interface Props {
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  lideresIniciales: Lider[];
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

interface FormState {
  cedula: string;
  nombres: string;
  telefono: string;
  ambito: "general" | "parroquia";
  parroquiaCodigo: number | "";
  recintoCodigos: number[];
}

const vacio: FormState = {
  cedula: "",
  nombres: "",
  telefono: "",
  ambito: "parroquia",
  parroquiaCodigo: "",
  recintoCodigos: [],
};

export default function GestionLideres({
  parroquias,
  recintos,
  lideresIniciales,
}: Props) {
  const [lideres, setLideres] = useState(lideresIniciales);
  const [form, setForm] = useState<FormState>(vacio);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const recintosDeForm = useMemo(
    () => recintos.filter((r) => r.par === form.parroquiaCodigo),
    [recintos, form.parroquiaCodigo],
  );

  const nombreParroquia = (cod: number | null) =>
    cod == null
      ? ""
      : (parroquias.find((p) => p.properties.code === cod)?.properties.name ??
        "");

  const refrescar = async () =>
    setLideres(await api<Lider[]>("/api/gestion/lideres"));

  const agregar = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/gestion/lideres", {
        method: "POST",
        body: JSON.stringify({
          cedula: form.cedula,
          nombres: form.nombres,
          telefono: form.telefono,
          ambito: form.ambito,
          parroquiaCodigo:
            form.ambito === "parroquia" ? form.parroquiaCodigo || null : null,
          recintoCodigos:
            form.ambito === "parroquia" ? form.recintoCodigos : [],
        }),
      });
      setForm(vacio);
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  const eliminar = async (id: string) => {
    await api(`/api/gestion/lideres/${id}`, { method: "DELETE" });
    await refrescar();
  };

  const guardarEdicion = async (id: string, patch: Partial<Lider>) => {
    await api(`/api/gestion/lideres/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    setEditandoId(null);
    await refrescar();
  };

  return (
    <div class="g-panel">
      <form class="g-form" onSubmit={agregar}>
        <p class="g-form-title">Agregar líder</p>
        <label>
          Cédula
          <input
            value={form.cedula}
            onInput={(e) =>
              setForm({
                ...form,
                cedula: (e.currentTarget as HTMLInputElement).value,
              })
            }
            inputMode="numeric"
            maxLength={10}
            required
          />
        </label>
        <label>
          Nombres y apellidos
          <input
            value={form.nombres}
            onInput={(e) =>
              setForm({
                ...form,
                nombres: (e.currentTarget as HTMLInputElement).value,
              })
            }
            required
          />
        </label>
        <label>
          Teléfono
          <input
            value={form.telefono}
            onInput={(e) =>
              setForm({
                ...form,
                telefono: (e.currentTarget as HTMLInputElement).value,
              })
            }
          />
        </label>
        <label>
          Ámbito
          <select
            value={form.ambito}
            onChange={(e) =>
              setForm({
                ...form,
                ambito: (e.currentTarget as HTMLSelectElement)
                  .value as FormState["ambito"],
              })
            }
          >
            <option value="parroquia">Líder de parroquia</option>
            <option value="general">Líder general de Latacunga</option>
          </select>
        </label>
        {form.ambito === "parroquia" ? (
          <>
            <label>
              Parroquia
              <select
                value={form.parroquiaCodigo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    parroquiaCodigo:
                      Number((e.currentTarget as HTMLSelectElement).value) ||
                      "",
                    recintoCodigos: [],
                  })
                }
                required
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
            {form.parroquiaCodigo ? (
              <fieldset class="g-checks">
                <legend>Recintos a cargo</legend>
                {recintosDeForm.map((r) => (
                  <label key={r.cod} class="g-check">
                    <input
                      type="checkbox"
                      checked={form.recintoCodigos.includes(r.cod)}
                      onChange={(e) => {
                        const checked = (e.currentTarget as HTMLInputElement)
                          .checked;
                        setForm({
                          ...form,
                          recintoCodigos: checked
                            ? [...form.recintoCodigos, r.cod]
                            : form.recintoCodigos.filter((c) => c !== r.cod),
                        });
                      }}
                    />
                    {title(r.nombre)}
                  </label>
                ))}
              </fieldset>
            ) : null}
          </>
        ) : null}
        {error ? <p class="g-error">{error}</p> : null}
        <div class="g-form-actions">
          <button type="submit">Guardar</button>
        </div>
      </form>

      <ul class="g-list">
        {lideres.map((l) =>
          editandoId === l.id ? (
            <li key={l.id}>
              <LiderEditForm
                lider={l}
                parroquias={parroquias}
                recintos={recintos}
                onGuardar={(patch) => guardarEdicion(l.id, patch)}
                onCancelar={() => setEditandoId(null)}
              />
            </li>
          ) : (
            <li key={l.id} class="g-persona">
              <div>
                <strong>{l.nombres}</strong>
                <small>
                  CI {l.cedula}
                  {l.telefono ? ` · ${l.telefono}` : ""}
                  {" · "}
                  {l.ambito === "general"
                    ? "Líder general de Latacunga"
                    : `Líder de ${nombreParroquia(l.parroquiaCodigo)}`}
                </small>
                {l.recintoCodigos.length > 0 ? (
                  <small>
                    Recintos:{" "}
                    {l.recintoCodigos
                      .map((cod) =>
                        title(
                          recintos.find((r) => r.cod === cod)?.nombre ?? "",
                        ),
                      )
                      .join(", ")}
                  </small>
                ) : null}
              </div>
              <div class="g-row-actions">
                <button class="g-btn-ghost" onClick={() => setEditandoId(l.id)}>
                  Editar
                </button>
                <button
                  class="g-btn-danger-ghost"
                  onClick={() => eliminar(l.id)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function LiderEditForm({
  lider,
  parroquias,
  recintos,
  onGuardar,
  onCancelar,
}: {
  lider: Lider;
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  onGuardar: (patch: Partial<Lider>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombres, setNombres] = useState(lider.nombres);
  const [telefono, setTelefono] = useState(lider.telefono);
  const [parroquiaCodigo, setParroquiaCodigo] = useState<number | "">(
    lider.parroquiaCodigo ?? "",
  );
  const [recintoCodigos, setRecintoCodigos] = useState<number[]>(
    lider.recintoCodigos,
  );
  const [error, setError] = useState<string | null>(null);

  const recintosDeParroquia = recintos.filter((r) => r.par === parroquiaCodigo);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await onGuardar({
        nombres,
        telefono,
        parroquiaCodigo:
          lider.ambito === "parroquia" ? parroquiaCodigo || null : null,
        recintoCodigos: lider.ambito === "parroquia" ? recintoCodigos : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  return (
    <form class="g-form" onSubmit={submit}>
      <p class="g-form-title">Editar líder</p>
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
      {lider.ambito === "parroquia" ? (
        <>
          <label>
            Parroquia
            <select
              value={parroquiaCodigo}
              onChange={(e) => {
                setParroquiaCodigo(
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
                );
                setRecintoCodigos([]);
              }}
            >
              <option value="">Selecciona…</option>
              {parroquias.map((p) => (
                <option key={p.properties.code} value={p.properties.code}>
                  {p.properties.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset class="g-checks">
            <legend>Recintos a cargo</legend>
            {recintosDeParroquia.map((r) => (
              <label key={r.cod} class="g-check">
                <input
                  type="checkbox"
                  checked={recintoCodigos.includes(r.cod)}
                  onChange={(e) => {
                    const checked = (e.currentTarget as HTMLInputElement)
                      .checked;
                    setRecintoCodigos(
                      checked
                        ? [...recintoCodigos, r.cod]
                        : recintoCodigos.filter((c) => c !== r.cod),
                    );
                  }}
                />
                {title(r.nombre)}
              </label>
            ))}
          </fieldset>
        </>
      ) : null}
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
