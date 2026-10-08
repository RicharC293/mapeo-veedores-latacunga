import { iniciales } from "../../lib/format";

interface Props {
  nombres: string;
  // titular: relleno de acento; suplente: apagado; neutro: sin rol.
  rol?: "titular" | "suplente" | "neutro";
}

// Círculo con las iniciales de la persona: separa de un vistazo a una persona
// de la siguiente y marca su rol por el color. Es decorativo: el nombre ya
// está escrito al lado.
export default function Iniciales({ nombres, rol = "neutro" }: Props) {
  return (
    <span class={`g-ini g-ini-${rol}`} aria-hidden="true">
      {iniciales(nombres) || "·"}
    </span>
  );
}
