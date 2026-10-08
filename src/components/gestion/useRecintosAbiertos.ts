import { useState } from "preact/hooks";

// Recintos plegables: abiertos por defecto cuando hay pocos a la vista. Solo
// se guarda lo que la persona abre o cierra a mano; el navegador también
// dispara "toggle" cuando el cambio lo hace la propia pantalla, y eso no
// cuenta como elección.
export function useRecintosAbiertos(abrirPorDefecto: boolean) {
  const [eleccion, setEleccion] = useState<Map<number, boolean>>(new Map());
  const estaAbierto = (cod: number) => eleccion.get(cod) ?? abrirPorDefecto;
  const alternar = (cod: number, abierto: boolean) => {
    if (abierto === estaAbierto(cod)) return;
    setEleccion((prev) => new Map(prev).set(cod, abierto));
  };
  return { estaAbierto, alternar };
}
