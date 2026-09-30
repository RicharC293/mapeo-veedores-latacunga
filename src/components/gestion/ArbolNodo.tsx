import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface Props {
  titulo: ComponentChildren;
  subtitulo?: ComponentChildren;
  defaultAbierto?: boolean;
  children: ComponentChildren;
}

export default function ArbolNodo({
  titulo,
  subtitulo,
  defaultAbierto = false,
  children,
}: Props) {
  const [abierto, setAbierto] = useState(defaultAbierto);

  return (
    <div class="g-tree-node">
      <button
        type="button"
        class="g-tree-toggle"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <svg
          class={
            "g-tree-chevron" + (abierto ? " g-tree-chevron-abierto" : "")
          }
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span class="g-tree-titulo">{titulo}</span>
        {subtitulo ? <span class="g-tree-subtitulo">{subtitulo}</span> : null}
      </button>
      <div
        class={
          "g-tree-children" + (abierto ? " g-tree-children-abierto" : "")
        }
      >
        <div class="g-tree-children-inner">{children}</div>
      </div>
    </div>
  );
}
