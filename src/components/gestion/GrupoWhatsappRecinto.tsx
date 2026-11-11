import { useState } from "preact/hooks";
import {
  normalizarEnlaceGrupo,
  type GrupoRecinto,
} from "../../lib/gestion/grupoWhatsapp";

interface Props {
  recintoCodigo: number;
  grupo: GrupoRecinto | undefined;
  onGuardado: (recintoCodigo: number, grupo: GrupoRecinto | null) => void;
}

async function guardar(
  recintoCodigo: number,
  enlace: string,
): Promise<GrupoRecinto | null> {
  const res = await fetch("/api/gestion/grupos-whatsapp", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recintoCodigo, enlace }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Error inesperado.");
  return body as GrupoRecinto | null;
}

// Enlace de invitación al grupo de WhatsApp del recinto, dentro de su
// detalle en el Consolidado: se agrega, se cambia o se quita.
export default function GrupoWhatsappRecinto({
  recintoCodigo,
  grupo,
  onGuardado,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const abrir = () => {
    setTexto(grupo?.enlace ?? "");
    setError(null);
    setEditando(true);
  };

  const enviar = async (e: Event) => {
    e.preventDefault();
    const enlace = normalizarEnlaceGrupo(texto);
    if (!enlace) {
      setError(
        "Pega el enlace de invitación del grupo: empieza con https://chat.whatsapp.com/",
      );
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      onGuardado(recintoCodigo, await guardar(recintoCodigo, enlace));
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    if (!window.confirm("¿Quitar el enlace del grupo de este recinto?")) return;
    setGuardando(true);
    setError(null);
    try {
      onGuardado(recintoCodigo, await guardar(recintoCodigo, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section class="g-consol-grupo">
      <h4>Grupo de WhatsApp</h4>
      {editando ? (
        <form class="g-consol-grupo-form" onSubmit={enviar}>
          <label>
            Enlace de invitación
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              value={texto}
              placeholder="https://chat.whatsapp.com/…"
              onInput={(e) =>
                setTexto((e.currentTarget as HTMLInputElement).value)
              }
            />
          </label>
          <small>
            En WhatsApp: información del grupo → Invitar mediante enlace →
            Copiar enlace.
          </small>
          {error ? <p class="g-error">{error}</p> : null}
          <div class="g-consol-grupo-acciones">
            <button type="submit" class="g-btn-accion" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar enlace"}
            </button>
            <button
              type="button"
              class="g-btn-ghost"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : grupo ? (
        <div class="g-consol-grupo-actual">
          <a href={grupo.enlace} target="_blank" rel="noopener noreferrer">
            {grupo.enlace}
          </a>
          <div class="g-consol-grupo-acciones">
            <button type="button" class="g-btn-ghost" onClick={abrir}>
              Cambiar
            </button>
            <button
              type="button"
              class="g-btn-ghost g-btn-danger-ghost"
              disabled={guardando}
              onClick={quitar}
            >
              Quitar
            </button>
          </div>
          {error ? <p class="g-error">{error}</p> : null}
        </div>
      ) : (
        <div class="g-consol-grupo-actual">
          <span class="g-consol-grupo-vacio">Sin grupo todavía.</span>
          <button type="button" class="g-btn-accion" onClick={abrir}>
            Agregar enlace
          </button>
        </div>
      )}
    </section>
  );
}
