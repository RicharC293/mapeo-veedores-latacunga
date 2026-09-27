import { useState } from "preact/hooks";

interface Props {
  onSubmit: (input: {
    cedula: string;
    nombres: string;
    telefono: string;
  }) => Promise<void>;
  onCancel: () => void;
  etiqueta: string;
}

export default function PersonaForm({ onSubmit, onCancel, etiqueta }: Props) {
  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onSubmit({ cedula, nombres, telefono });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form class="g-form" onSubmit={submit}>
      <p class="g-form-title">{etiqueta}</p>
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
      {error ? <p class="g-error">{error}</p> : null}
      <div class="g-form-actions">
        <button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" class="g-btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
