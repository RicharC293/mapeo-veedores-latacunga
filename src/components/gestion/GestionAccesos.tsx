import { useState } from "preact/hooks";
import type { Acceso } from "../../lib/gestion/accesos";

interface Props {
  origin: string;
  accesosIniciales: Acceso[];
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

export default function GestionAccesos({ origin, accesosIniciales }: Props) {
  const [accesos, setAccesos] = useState(accesosIniciales);
  const [rol, setRol] = useState<"militante" | "gestor">("militante");
  const [etiqueta, setEtiqueta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEdit, setNombreEdit] = useState("");
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const refrescar = async () =>
    setAccesos(await api<Acceso[]>("/api/gestion/accesos"));

  const crear = async (e: Event) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/gestion/accesos", {
        method: "POST",
        body: JSON.stringify({ rol, etiqueta }),
      });
      setEtiqueta("");
      await refrescar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  const revocar = async (id: string) => {
    await api(`/api/gestion/accesos/${id}/revocar`, { method: "POST" });
    await refrescar();
  };

  const guardarNombre = async (id: string) => {
    setErrorEdit(null);
    try {
      await api(`/api/gestion/accesos/${id}/renombrar`, {
        method: "POST",
        body: JSON.stringify({ etiqueta: nombreEdit }),
      });
      setEditandoId(null);
      await refrescar();
    } catch (err) {
      setErrorEdit(err instanceof Error ? err.message : "Error inesperado.");
    }
  };

  const copiar = async (acceso: Acceso) => {
    const url = `${origin}/acceso/${acceso.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiadoId(acceso.id);
      setTimeout(() => setCopiadoId(null), 2000);
    } catch {
      window.prompt("Copia el enlace:", url);
    }
  };

  return (
    <div class="g-panel">
      <form class="g-form" onSubmit={crear}>
        <p class="g-form-title">Generar enlace de acceso</p>
        <label>
          Rol
          <select
            value={rol}
            onChange={(e) =>
              setRol(
                (e.currentTarget as HTMLSelectElement).value as
                  "militante" | "gestor",
              )
            }
          >
            <option value="militante">Militante</option>
            <option value="gestor">Gestor</option>
          </select>
        </label>
        <label>
          {rol === "gestor" ? "Nombre del gestor" : "Etiqueta"}
          <input
            value={etiqueta}
            onInput={(e) =>
              setEtiqueta((e.currentTarget as HTMLInputElement).value)
            }
            required={rol === "gestor"}
            placeholder={
              rol === "gestor"
                ? "Se muestra en el historial"
                : "Para quién es este enlace (opcional)"
            }
          />
        </label>
        {rol === "gestor" ? (
          <p class="g-sub">
            El gestor puede hacer todo en Militancia (cargar, editar, asignar y
            eliminar) y gestionar veedores, coordinadores, acreditados CDA y la
            lista negra. Sus cambios quedan registrados con este nombre.
          </p>
        ) : (
          <p class="g-sub">
            El militante solo puede consultar cobertura, crecimiento,
            organigrama y estructura.
          </p>
        )}
        {error ? <p class="g-error">{error}</p> : null}
        <div class="g-form-actions">
          <button type="submit">Generar</button>
        </div>
      </form>

      <ul class="g-list g-accesos">
        {accesos.length === 0 ? (
          <li class="g-empty">Todavía no hay enlaces generados.</li>
        ) : (
          accesos.map((a) => (
            <li key={a.id} class="g-persona">
              <div class="g-persona-info">
                {editandoId === a.id ? (
                  <div class="g-acceso-edicion">
                    <input
                      value={nombreEdit}
                      aria-label="Nombre"
                      onInput={(e) =>
                        setNombreEdit(
                          (e.currentTarget as HTMLInputElement).value,
                        )
                      }
                    />
                    <button
                      type="button"
                      class="g-btn-accion"
                      onClick={() => guardarNombre(a.id)}
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      class="g-btn-ghost"
                      onClick={() => setEditandoId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <strong>
                    {a.etiqueta ||
                      (a.rol === "gestor"
                        ? "Gestor sin nombre"
                        : "Sin etiqueta")}
                  </strong>
                )}
                {editandoId === a.id && errorEdit ? (
                  <p class="g-error">{errorEdit}</p>
                ) : null}
                <small>
                  {a.rol === "militante" ? "Militante" : "Gestor"}
                  {a.activo ? "" : " · Revocado"}
                  {a.ultimoUsoEn
                    ? ` · Último uso ${new Date(a.ultimoUsoEn).toLocaleDateString("es-EC")}`
                    : " · Sin usar"}
                </small>
              </div>
              <div class="g-row-actions">
                {a.activo ? (
                  <>
                    <button
                      class="g-btn-ghost"
                      onClick={() => {
                        setNombreEdit(a.etiqueta);
                        setErrorEdit(null);
                        setEditandoId(a.id);
                      }}
                    >
                      Renombrar
                    </button>
                    <button class="g-btn-ghost" onClick={() => copiar(a)}>
                      {copiadoId === a.id ? "¡Copiado!" : "Copiar enlace"}
                    </button>
                    <button
                      class="g-btn-danger-ghost"
                      onClick={() => revocar(a.id)}
                    >
                      Revocar
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
