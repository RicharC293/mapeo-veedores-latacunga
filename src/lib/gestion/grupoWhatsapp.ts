// Grupo de WhatsApp de un recinto (lógica pura, sin base): el enlace de
// invitación que se pega desde WhatsApp y cómo se guarda.

export interface GrupoRecinto {
  recintoCodigo: number;
  enlace: string;
  actualizadoPor: string | null;
  actualizadoEn: string;
}

// Lo que se pega desde "Invitar al grupo mediante enlace" → la forma que se
// guarda (https://chat.whatsapp.com/CODIGO), o null si no es un enlace de
// invitación. Acepta el enlace sin https:// y quita lo que va tras el código
// (por ejemplo ?mode=…).
export function normalizarEnlaceGrupo(texto: string): string | null {
  const m =
    /^(?:https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,})(?:[/?#].*)?$/i.exec(
      texto.trim(),
    );
  return m ? `https://chat.whatsapp.com/${m[1]}` : null;
}
