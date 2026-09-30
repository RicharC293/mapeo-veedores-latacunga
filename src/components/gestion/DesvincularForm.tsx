import { useState } from "preact/hooks";

interface Props {
  onConfirm: (motivo: string | null, listaNegra: boolean) => Promise<void>;
  onCancel: () => void;
}

export default function DesvincularForm({ onConfirm, onCancel }: Props) {
  const [motivo, setMotivo] = useState("");
  const [listaNegra, setListaNegra] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await onConfirm(motivo.trim() || null, listaNegra);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
      setEnviando(false);
    }
  };

  return (
    <form class="g-form g-form-danger" onSubmit={submit}>
      <p class="g-form-title">Desvincular</p>
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
      <label class="g-check g-check-verificado">
        <input
          type="checkbox"
          checked={listaNegra}
          onChange={(e) =>
            setListaNegra((e.currentTarget as HTMLInputElement).checked)
          }
        />
        Enviar a la lista negra
      </label>
      {error ? <p class="g-error">{error}</p> : null}
      <div class="g-form-actions">
        <button type="submit" class="g-btn-danger" disabled={enviando}>
          {enviando ? "Enviando…" : "Confirmar"}
        </button>
        <button type="button" class="g-btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
