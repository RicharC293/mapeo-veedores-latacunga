import { useState } from "preact/hooks";
import type { Lider } from "../../lib/gestion/types";

interface Props {
  lideres: Lider[];
  onSubmit: (input: {
    cedula: string;
    nombres: string;
    telefono: string;
    email: string;
    responsableLiderId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  etiqueta: string;
}

export default function PersonaForm({
  lideres,
  onSubmit,
  onCancel,
  etiqueta,
}: Props) {
  const [cedula, setCedula] = useState("");
  const [nombres, setNombres] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [responsableLiderId, setResponsableLiderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onSubmit({
        cedula,
        nombres,
        telefono,
        email,
        responsableLiderId: responsableLiderId || null,
      });
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
      <label>
        Correo electrónico
        <input
          type="email"
          value={email}
          onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
          placeholder="Opcional"
        />
      </label>
      <label>
        Responsable
        <select
          value={responsableLiderId}
          onChange={(e) =>
            setResponsableLiderId(
              (e.currentTarget as HTMLSelectElement).value,
            )
          }
        >
          <option value="">Sin responsable</option>
          {lideres
            .slice()
            .sort((a, b) => a.nombres.localeCompare(b.nombres))
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombres}
              </option>
            ))}
        </select>
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
