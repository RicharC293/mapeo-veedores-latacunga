import { useMemo, useState } from "preact/hooks";
import { title } from "../../lib/format";
import type { ParroquiaFeature, Recinto } from "../../lib/types";
import { CARGO_LABEL, CUPO_CARGO } from "../../lib/gestion/types";
import type { AmbitoLider, Cargo, Lider } from "../../lib/gestion/types";

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

const CARGOS: Cargo[] = [
  "alcalde",
  "concejal_urbano",
  "concejal_rural",
  "vocal_junta_parroquial",
];

const CARGO_CANTONAL: Cargo[] = ["alcalde", "concejal_urbano", "concejal_rural"];

function cupoTexto(cargo: Cargo, lideres: Lider[], idExcluir?: string) {
  const n = lideres.filter(
    (l) => l.cargo === cargo && l.id !== idExcluir,
  ).length;
  if (cargo === "vocal_junta_parroquial") {
    return `${n} de 10 parroquias rurales ya tienen vocal asignado.`;
  }
  return `${n}/${CUPO_CARGO[cargo]} ocupados.`;
}

function iniciales(nombres: string) {
  return (
    nombres
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?"
  );
}

function Avatar({ lider }: { lider: Lider }) {
  return lider.foto ? (
    <img class="g-avatar" src={lider.foto} alt={lider.nombres} />
  ) : (
    <div class="g-avatar-placeholder">{iniciales(lider.nombres)}</div>
  );
}

function FotoUploader({
  liderId,
  onSubido,
}: {
  liderId: string;
  onSubido: () => Promise<void>;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subir = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("foto", file);
      const res = await fetch(`/api/gestion/lideres/${liderId}/foto`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
      await onSubido();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setSubiendo(false);
      input.value = "";
    }
  };

  return (
    <div class="g-foto-uploader">
      <label class="g-btn-ghost">
        {subiendo ? "Subiendo…" : "Cambiar foto"}
        <input
          type="file"
          accept="image/*"
          hidden
          onInput={subir}
          disabled={subiendo}
        />
      </label>
      {error ? <small class="g-error">{error}</small> : null}
    </div>
  );
}

function RecintosCantonales({
  parroquias,
  recintos,
  seleccion,
  onChange,
}: {
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  seleccion: number[];
  onChange: (next: number[]) => void;
}) {
  const parroquiasOrdenadas = useMemo(
    () =>
      parroquias
        .slice()
        .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
    [parroquias],
  );

  return (
    <fieldset class="g-checks">
      <legend>Recintos a cargo (todo el cantón)</legend>
      {parroquiasOrdenadas.map((p) => {
        const recintosDeParroquia = recintos.filter(
          (r) => r.par === p.properties.code,
        );
        if (recintosDeParroquia.length === 0) return null;
        return (
          <div key={p.properties.code}>
            <span class="g-slot-label">{p.properties.name}</span>
            {recintosDeParroquia.map((r) => (
              <label key={r.cod} class="g-check">
                <input
                  type="checkbox"
                  checked={seleccion.includes(r.cod)}
                  onChange={(e) => {
                    const checked = (e.currentTarget as HTMLInputElement)
                      .checked;
                    onChange(
                      checked
                        ? [...seleccion, r.cod]
                        : seleccion.filter((c) => c !== r.cod),
                    );
                  }}
                />
                {title(r.nombre)}
              </label>
            ))}
          </div>
        );
      })}
    </fieldset>
  );
}

function ParroquiasACargo({
  parroquias,
  seleccion,
  onChange,
}: {
  parroquias: ParroquiaFeature[];
  seleccion: number[];
  onChange: (next: number[]) => void;
}) {
  const ordenadas = useMemo(
    () =>
      parroquias
        .slice()
        .sort((a, b) => a.properties.name.localeCompare(b.properties.name)),
    [parroquias],
  );

  return (
    <fieldset class="g-checks">
      <legend>Parroquias a cargo (una o varias)</legend>
      {ordenadas.map((p) => (
        <label key={p.properties.code} class="g-check">
          <input
            type="checkbox"
            checked={seleccion.includes(p.properties.code)}
            onChange={(e) => {
              const checked = (e.currentTarget as HTMLInputElement).checked;
              onChange(
                checked
                  ? [...seleccion, p.properties.code]
                  : seleccion.filter((c) => c !== p.properties.code),
              );
            }}
          />
          {p.properties.name}
        </label>
      ))}
    </fieldset>
  );
}

interface FormState {
  cedula: string;
  nombres: string;
  telefono: string;
  organizacion: string;
  ambito: AmbitoLider;
  parroquiaCodigo: number | "";
  parroquiaCodigos: number[];
  recintoCodigos: number[];
  cargo: Cargo | "";
}

const vacio: FormState = {
  cedula: "",
  nombres: "",
  telefono: "",
  organizacion: "",
  ambito: "parroquia",
  parroquiaCodigo: "",
  parroquiaCodigos: [],
  recintoCodigos: [],
  cargo: "",
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

  const parroquiasRurales = useMemo(
    () => parroquias.filter((p) => !p.properties.urbana),
    [parroquias],
  );

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
          cedula: form.cedula.trim() || null,
          nombres: form.nombres,
          telefono: form.telefono,
          organizacion: form.organizacion,
          ambito: form.ambito,
          parroquiaCodigo: form.parroquiaCodigo || null,
          parroquiaCodigos: form.parroquiaCodigos,
          recintoCodigos: form.recintoCodigos,
          cargo: form.cargo || null,
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

  const esCandidato = form.ambito === "candidato";
  const mostrarSelectorCantonal =
    !esCandidato && CARGO_CANTONAL.includes(form.cargo as Cargo);
  const mostrarSelectorParroquia =
    !esCandidato &&
    !mostrarSelectorCantonal &&
    (form.cargo === "vocal_junta_parroquial" || form.ambito === "parroquia");

  return (
    <div class="g-panel">
      <form class="g-form" onSubmit={agregar}>
        <p class="g-form-title">Agregar líder</p>
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
            placeholder="Opcional"
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
          Organización
          <input
            value={form.organizacion}
            onInput={(e) =>
              setForm({
                ...form,
                organizacion: (e.currentTarget as HTMLInputElement).value,
              })
            }
            placeholder="Opcional"
          />
        </label>
        <label>
          Ámbito
          <select
            value={form.ambito}
            onChange={(e) => {
              const ambito = (e.currentTarget as HTMLSelectElement)
                .value as AmbitoLider;
              setForm({
                ...form,
                ambito,
                // Un candidato no tiene cargo ni recintos; y la lista de
                // parroquias a cargo solo aplica al candidato.
                cargo: ambito === "candidato" ? "" : form.cargo,
                parroquiaCodigos:
                  ambito === "candidato" ? form.parroquiaCodigos : [],
                recintoCodigos:
                  ambito === "candidato" ? [] : form.recintoCodigos,
              });
            }}
          >
            <option value="parroquia">Líder de parroquia</option>
            <option value="general">Líder general de Latacunga</option>
            <option value="candidato">Candidato</option>
          </select>
        </label>
        {esCandidato ? null : (
          <label>
            Cargo (dignidad)
            <select
              value={form.cargo}
              onChange={(e) => {
                const cargo = (e.currentTarget as HTMLSelectElement)
                  .value as FormState["cargo"];
                setForm({
                  ...form,
                  cargo,
                  parroquiaCodigo: "",
                  recintoCodigos: [],
                });
              }}
            >
              <option value="">Ninguno</option>
              {CARGOS.map((c) => (
                <option key={c} value={c}>
                  {CARGO_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.cargo ? (
          <p class="g-empty">{cupoTexto(form.cargo, lideres)}</p>
        ) : null}
        {esCandidato ? (
          <ParroquiasACargo
            parroquias={parroquias}
            seleccion={form.parroquiaCodigos}
            onChange={(next) => setForm({ ...form, parroquiaCodigos: next })}
          />
        ) : null}
        {mostrarSelectorParroquia ? (
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
                {(form.cargo === "vocal_junta_parroquial"
                  ? parroquiasRurales
                  : parroquias
                )
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
        ) : mostrarSelectorCantonal ? (
          <RecintosCantonales
            parroquias={parroquias}
            recintos={recintos}
            seleccion={form.recintoCodigos}
            onChange={(next) => setForm({ ...form, recintoCodigos: next })}
          />
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
                lideres={lideres}
                parroquias={parroquias}
                recintos={recintos}
                onGuardar={(patch) => guardarEdicion(l.id, patch)}
                onCancelar={() => setEditandoId(null)}
              />
            </li>
          ) : (
            <li key={l.id} class="g-persona">
              <Avatar lider={l} />
              <div>
                <strong>{l.nombres}</strong>
                <small>
                  {[
                    l.cedula ? `CI ${l.cedula}` : null,
                    l.telefono || null,
                    l.ambito === "general"
                      ? "Líder general de Latacunga"
                      : l.ambito === "candidato"
                        ? "Candidato"
                        : `Líder de ${nombreParroquia(l.parroquiaCodigo)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                {l.ambito === "candidato" ? (
                  <small>
                    {l.parroquiaCodigos.length > 0
                      ? `Parroquias a cargo: ${l.parroquiaCodigos
                          .map((cod) => nombreParroquia(cod))
                          .join(", ")}`
                      : "Sin parroquias asignadas"}
                  </small>
                ) : null}
                {l.cargo ? (
                  <small>
                    Dignidad: {CARGO_LABEL[l.cargo]}
                    {l.cargo === "vocal_junta_parroquial"
                      ? ` (${nombreParroquia(l.parroquiaCodigo)})`
                      : ""}
                  </small>
                ) : null}
                {l.organizacion ? (
                  <small>Organización: {l.organizacion}</small>
                ) : null}
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
                <FotoUploader liderId={l.id} onSubido={refrescar} />
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
  lideres,
  parroquias,
  recintos,
  onGuardar,
  onCancelar,
}: {
  lider: Lider;
  lideres: Lider[];
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
  onGuardar: (patch: Partial<Lider>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nombres, setNombres] = useState(lider.nombres);
  const [telefono, setTelefono] = useState(lider.telefono);
  const [organizacion, setOrganizacion] = useState(lider.organizacion);
  const [ambito, setAmbito] = useState<AmbitoLider>(lider.ambito);
  const [cargo, setCargo] = useState<Cargo | "">(lider.cargo ?? "");
  const [parroquiaCodigo, setParroquiaCodigo] = useState<number | "">(
    lider.parroquiaCodigo ?? "",
  );
  const [parroquiaCodigos, setParroquiaCodigos] = useState<number[]>(
    lider.parroquiaCodigos,
  );
  const [recintoCodigos, setRecintoCodigos] = useState<number[]>(
    lider.recintoCodigos,
  );
  const [error, setError] = useState<string | null>(null);

  const parroquiasRurales = useMemo(
    () => parroquias.filter((p) => !p.properties.urbana),
    [parroquias],
  );
  const recintosDeParroquia = recintos.filter((r) => r.par === parroquiaCodigo);
  const esCandidato = ambito === "candidato";
  const mostrarSelectorCantonal =
    !esCandidato && CARGO_CANTONAL.includes(cargo as Cargo);
  const mostrarSelectorParroquia =
    !esCandidato &&
    !mostrarSelectorCantonal &&
    (cargo === "vocal_junta_parroquial" || ambito === "parroquia");

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await onGuardar({
        nombres,
        telefono,
        organizacion,
        ambito,
        cargo: esCandidato ? null : cargo || null,
        parroquiaCodigo: mostrarSelectorParroquia ? parroquiaCodigo || null : null,
        parroquiaCodigos: esCandidato ? parroquiaCodigos : [],
        recintoCodigos:
          mostrarSelectorParroquia || mostrarSelectorCantonal
            ? recintoCodigos
            : [],
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
      <label>
        Organización
        <input
          value={organizacion}
          onInput={(e) =>
            setOrganizacion((e.currentTarget as HTMLInputElement).value)
          }
          placeholder="Opcional"
        />
      </label>
      <label>
        Ámbito
        <select
          value={ambito}
          onChange={(e) => {
            const nuevo = (e.currentTarget as HTMLSelectElement)
              .value as AmbitoLider;
            setAmbito(nuevo);
            if (nuevo === "candidato") {
              setCargo("");
              setParroquiaCodigo("");
              setRecintoCodigos([]);
            } else {
              setParroquiaCodigos([]);
            }
          }}
        >
          <option value="parroquia">Líder de parroquia</option>
          <option value="general">Líder general de Latacunga</option>
          <option value="candidato">Candidato</option>
        </select>
      </label>
      {esCandidato ? null : (
        <label>
          Cargo (dignidad)
          <select
            value={cargo}
            onChange={(e) => {
              const nuevo = (e.currentTarget as HTMLSelectElement)
                .value as Cargo | "";
              setCargo(nuevo);
              setParroquiaCodigo("");
              setRecintoCodigos([]);
            }}
          >
            <option value="">Ninguno</option>
            {CARGOS.map((c) => (
              <option key={c} value={c}>
                {CARGO_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      )}
      {cargo ? (
        <p class="g-empty">{cupoTexto(cargo, lideres, lider.id)}</p>
      ) : null}
      {esCandidato ? (
        <ParroquiasACargo
          parroquias={parroquias}
          seleccion={parroquiaCodigos}
          onChange={setParroquiaCodigos}
        />
      ) : null}
      {mostrarSelectorParroquia ? (
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
              {(cargo === "vocal_junta_parroquial"
                ? parroquiasRurales
                : parroquias
              ).map((p) => (
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
      ) : mostrarSelectorCantonal ? (
        <RecintosCantonales
          parroquias={parroquias}
          recintos={recintos}
          seleccion={recintoCodigos}
          onChange={setRecintoCodigos}
        />
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
