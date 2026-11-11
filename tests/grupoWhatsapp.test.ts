import { describe, expect, it } from "vitest";
import { normalizarEnlaceGrupo } from "../src/lib/gestion/grupoWhatsapp";

describe("normalizarEnlaceGrupo", () => {
  it("acepta el enlace de invitación tal como lo copia WhatsApp", () => {
    expect(
      normalizarEnlaceGrupo(
        " https://chat.whatsapp.com/AbCdEfGhIj123456789012 ",
      ),
    ).toBe("https://chat.whatsapp.com/AbCdEfGhIj123456789012");
    expect(
      normalizarEnlaceGrupo("chat.whatsapp.com/AbCdEfGhIj123?mode=ems_copy_t"),
    ).toBe("https://chat.whatsapp.com/AbCdEfGhIj123");
    expect(
      normalizarEnlaceGrupo("https://chat.whatsapp.com/invite/AbCdEfGhIj123"),
    ).toBe("https://chat.whatsapp.com/AbCdEfGhIj123");
  });

  it("rechaza lo que no es una invitación a un grupo", () => {
    expect(normalizarEnlaceGrupo("")).toBeNull();
    expect(normalizarEnlaceGrupo("https://wa.me/593987654321")).toBeNull();
    expect(normalizarEnlaceGrupo("https://chat.whatsapp.com/")).toBeNull();
    expect(
      normalizarEnlaceGrupo("https://evil.com/chat.whatsapp.com/AbCdEfGhIj"),
    ).toBeNull();
  });
});
