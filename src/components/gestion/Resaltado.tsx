import { partirResaltado } from "../../lib/gestion/resaltar";

interface Props {
  texto: string;
  consulta: string;
}

// Muestra el texto con lo que coincide con la búsqueda pintado aparte.
export default function Resaltado({ texto, consulta }: Props) {
  const trozos = partirResaltado(texto, consulta);
  if (trozos.length === 1 && !trozos[0].coincide) return <>{texto}</>;
  return (
    <>
      {trozos.map((t) =>
        t.coincide ? <mark class="g-resaltado">{t.texto}</mark> : t.texto,
      )}
    </>
  );
}
