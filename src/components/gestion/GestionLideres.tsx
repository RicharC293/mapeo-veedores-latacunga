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

function ordenar(parroquias: ParroquiaFeature[]) {
  return parroquias
    .slice()
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name));
}

function Recintos({
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
  return (
    <fieldset class="g-checks">
      <legend>Recintos a cargo (opcional)</legend>
      {ordenar(parroquias).map((p) => {
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
  return (
    <fieldset class="g-checks">
      <legend>Parroquias a cargo (una o varias)</legend>
      {ordenar(parroquias).map((p) => (
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

// Cargo (dignidad) y ámbito de liderazgo son independientes: una persona
// puede ser candidata sin liderar nada, o liderar sin ser candidata.
interface Asignacion {
  cargo: Cargo | "";
  parroquiaCodigo: number | "";
  ambito: AmbitoLider | "";
  parroquiaCodigos: number[];
  recintoCodigos: number[];
}

const asignacionVacia: Asignacion = {
  cargo: "",
  parroquiaCodigo: "",
  ambito: "",
  parroquiaCodigos: [],
  recintoCodigos: [],
};

function CamposAsignacion({
  valor,
  onChange,
  lideres,
  idExcluir,
  parroquias,
  recintos,
}: {
  valor: Asignacion;
  onChange: (next: Asignacion) => void;
  lideres: Lider[];
  idExcluir?: string;
  parroquias: ParroquiaFeature[];
  recintos: Recinto[];
}) {
  const parroquiasRurales = useMemo(
    () => parroquias.filter((p) => !p.properties.urbana),
    [parroquias],
  );
  const aCargo = parroquias.filter((p) =>
    valor.parroquiaCodigos.includes(p.properties.code),
  );

  return (
    <>
      <label>
        Cargo (dignidad)
        <select
          value={valor.cargo}
          onChange={(e) =>
            onChange({
              ...valor,
              cargo: (e.currentTarget as HTMLSelectElement)
                .value as Asignacion["cargo"],
              parroquiaCodigo: "",
            })
          }
        >
          <option value="">Ninguno</option>
          {CARGOS.map((c) => (
            <option key={c} value={c}>
              {CARGO_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      {valor.cargo ? (
        <p class="g-empty">{cupoTexto(valor.cargo, lideres, idExcluir)}</p>
      ) : null}
      {valor.cargo === "vocal_junta_parroquial" ? (
        <label>
          Parroquia del vocal
          <select
            value={valor.parroquiaCodigo}
            onChange={(e) =>
              onChange({
                ...valor,
                parroquiaCodigo:
                  Number((e.currentTarget as HTMLSelectElement).value) || "",
              })
            }
            required
          >
            <option value="">Selecciona…</option>
            {ordenar(parroquiasRurales).map((p) => (
              <option key={p.properties.code} value={p.properties.code}>
                {p.properties.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Ámbito de liderazgo
        <select
          value={valor.ambito}
          onChange={(e) => {
            const ambito = (e.currentTarget as HTMLSelectElement)
              .value as Asignacion["ambito"];
            onChange({
              ...valor,
              ambito,
              parroquiaCodigos: ambito === "parroquia" ? valor.parroquiaCodigos : [],
              recintoCodigos: ambito ? valor.recintoCodigos : [],
            });
          }}
        >
          <option value="">Ninguno</option>
          <option value="parroquia">Líder de parroquia</option>
          <option value="general">Líder general de Latacunga</option>
        </select>
      </label>
      {valor.ambito === "parroquia" ? (
        <ParroquiasACargo
          parroquias={parroquias}
          seleccion={valor.parroquiaCodigos}
          onChange={(next) =>
            onChange({
              ...valor,
              parroquiaCodigos: next,
              recintoCodigos: valor.recintoCodigos.filter((cod) => {
                const par = recintos.find((r) => r.cod === cod)?.par;
                return par !== undefined && next.includes(par);
              }),
            })
          }
        />
      ) : null}
      {valor.ambito === "parroquia" && aCargo.length > 0 ? (
        <Recintos
          parroquias={aCargo}
          recintos={recintos}
          seleccion={valor.recintoCodigos}
          onChange={(next) => onChange({ ...valor, recintoCodigos: next })}
        />
      ) : null}
      {valor.ambito === "general" ? (
        <Recintos
          parroquias={parroquias}
          recintos={recintos}
          seleccion={valor.recintoCodigos}
          onChange={(next) => onChange({ ...valor, recintoCodigos: next })}
        />
      ) : null}
    </>
  );
}

function aPayload(a: Asignacion) {
  return {
    cargo: a.cargo || null,
    parroquiaCodigo: a.parroquiaCodigo || null,
    ambito: a.ambito || null,
    parroquiaCodigos: a.parroquiaCodigos,
    recintoCodigos: a.recintoCodigos,
  };
}

interface FormState {
  cedula: string;
  nombres: string;
  telefono: string;
  organizacion: string;
  asignacion: Asignacion;
}

const vacio: FormState = {
  cedula: "",
  nombres: "",
  telefono: "",
  organizacion: "",
  asignacion: asignacionVacia,
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
          ...aPayload(form.asignacion),
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
    <div class="g-panel g-panel-split">
      <form class="g-form g-form-lateral" onSubmit={agregar}>
        <p class="g-form-title">Agregar persona</p>
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
        <CamposAsignacion
          valor={form.asignacion}
          onChange={(asignacion) => setForm({ ...form, asignacion })}
          lideres={lideres}
          parroquias={parroquias}
          recintos={recintos}
        />
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
              <div class="g-persona-info">
                <strong>{l.nombres}</strong>
                <small>
                  {[l.cedula ? `CI ${l.cedula}` : null, l.telefono || null]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
                {l.cargo ? (
                  <small>
                    Dignidad: {CARGO_LABEL[l.cargo]}
                    {l.cargo === "vocal_junta_parroquial"
                      ? ` (${nombreParroquia(l.parroquiaCodigo)})`
                      : ""}
                  </small>
                ) : null}
                {l.ambito === "general" ? (
                  <small>Líder general de Latacunga</small>
                ) : null}
                {l.ambito === "parroquia" ? (
                  <small>
                    Líder de:{" "}
                    {l.parroquiaCodigos
                      .map((cod) => nombreParroquia(cod))
                      .join(", ")}
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
  const [asignacion, setAsignacion] = useState<Asignacion>({
    cargo: lider.cargo ?? "",
    parroquiaCodigo: lider.parroquiaCodigo ?? "",
    ambito: lider.ambito ?? "",
    parroquiaCodigos: lider.parroquiaCodigos,
    recintoCodigos: lider.recintoCodigos,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await onGuardar({ nombres, telefono, organizacion, ...aPayload(asignacion) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  return (
    <form class="g-form" onSubmit={submit}>
      <p class="g-form-title">Editar persona</p>
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
      <CamposAsignacion
        valor={asignacion}
        onChange={setAsignacion}
        lideres={lideres}
        idExcluir={lider.id}
        parroquias={parroquias}
        recintos={recintos}
      />
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
