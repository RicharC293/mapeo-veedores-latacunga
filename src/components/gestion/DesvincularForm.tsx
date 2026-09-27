import { useState } from "preact/hooks";

interface Props {
  onConfirm: (motivo: string | null) => Promise<void>;
  onCancel: () => void;
}

export default function DesvincularForm({ onConfirm, onCancel }: Props) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onConfirm(motivo.trim() || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setEnviando(false);
    }
  };

  return (
    <form class="g-form g-form-danger" onSubmit={submit}>
      <p class="g-form-title">Desvincular y enviar a la lista negra</p>
      <label>
        Observación (opcional)
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
        <button type="submit" class="g-btn-danger" disabled={enviando}>
          {enviando ? "Desvinculando…" : "Confirmar desvinculación"}
        </button>
        <button type="button" class="g-btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
