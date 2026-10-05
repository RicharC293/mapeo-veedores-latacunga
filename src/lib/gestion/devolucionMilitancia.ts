import { randomUUID } from "node:crypto";
import { mutateCollection } from "./jsonStore";
import type { Militante, TipoMilitancia } from "./types";

// Respaldo JSON local (sin Supabase) de lo que en Supabase hace la rama
// "sin lista negra" de las funciones desvincular_*: quien se retira de
// veedores/coordinadores/CDA sin ir a la lista negra vuelve a la bandeja de
// Militancia con sus datos y el destino de donde salió (recinto, tipo y, si
// era veedor, la mesa), para poder asignarlo de nuevo.
export async function devolverAMilitanciaLocal(persona: {
  cedula: string;
  nombres: string;
  telefono: string;
  email?: string;
  responsableLiderId: string | null;
  // Destino de donde salió: se precarga en la fila de Militancia.
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: TipoMilitancia;
  juntaId?: string;
}): Promise<void> {
  const militante: Omit<Militante, "duplicado" | "incorrecto"> = {
    id: randomUUID(),
    cedula: persona.cedula,
    nombres: persona.nombres,
    telefono: persona.telefono,
    email: persona.email ?? "",
    preferencia: "",
    responsableLiderId: persona.responsableLiderId,
    recintoCodigo: persona.recintoCodigo,
    parroquiaCodigo: persona.parroquiaCodigo,
    tipoPreasignado: persona.tipo,
    juntaPreasignada: persona.juntaId ?? null,
    creadoEn: new Date().toISOString(),
  };
  await mutateCollection<typeof militante>("militantes", (items) => [
    ...items,
    militante,
  ]);
}
