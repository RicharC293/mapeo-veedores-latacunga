import { useEffect, useRef } from "preact/hooks";
import DesvincularForm from "./DesvincularForm";

interface Props {
  nombres: string;
  onConfirm: (motivo: string | null, listaNegra: boolean) => Promise<void>;
  onCerrar: () => void;
}

// Desvincular desde un diálogo nativo: foco atrapado, Escape cierra.
export default function DialogoDesvincular({
  nombres,
  onConfirm,
  onCerrar,
}: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      class="g-dialogo"
      aria-labelledby="g-desvincular-titulo"
      onClose={onCerrar}
    >
      <h3 id="g-desvincular-titulo">Desvincular a {nombres}</h3>
      <p class="g-sub">
        Si no va a la lista negra, vuelve a Militancia con sus datos y se puede
        volver a asignar.
      </p>
      <DesvincularForm
        onConfirm={async (motivo, listaNegra) => {
          await onConfirm(motivo, listaNegra);
          ref.current?.close();
        }}
        onCancel={() => ref.current?.close()}
      />
    </dialog>
  );
}
