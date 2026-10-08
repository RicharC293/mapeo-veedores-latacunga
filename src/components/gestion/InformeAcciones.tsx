import { aCsv, type Celda } from "../../lib/gestion/csv";

interface Props {
  encabezados: string[];
  filas: Celda[][];
  nombreArchivo: string;
}

// Imprimir o guardar el informe en PDF (con el diálogo del navegador) y
// descargar el detalle por recinto en CSV. Se ocultan al imprimir.
export default function InformeAcciones({
  encabezados,
  filas,
  nombreArchivo,
}: Props) {
  const descargar = () => {
    const blob = new Blob([aCsv(encabezados, filas)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="g-informe-acciones">
      <button type="button" class="g-btn-accion" onClick={() => window.print()}>
        Imprimir o guardar en PDF
      </button>
      <button type="button" class="g-btn-ghost" onClick={descargar}>
        Descargar detalle (CSV)
      </button>
    </div>
  );
}
