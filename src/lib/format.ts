export const fmt = (n: number): string => n.toLocaleString("es-EC");

export const title = (s: string): string =>
  s
    .toLowerCase()
    .replace(
      /(^|[\s/(.-])([a-záéíóúñü])/g,
      (_m, a: string, b: string) => a + b.toUpperCase(),
    )
    .replace(/\b(De|Del|La|Las|Los|Y|E|En|El|Entre)\b/g, (m) => m.toLowerCase())
    .replace(/\bU\. ?e\./g, "U.E.")
    .replace(/\b(Pcei|Cecib|Uecib|Iv)\b/g, (m) => m.toUpperCase())
    .replace(
      /(^|U\.E\. |\(|- |\/ ?)([a-z])/g,
      (_m, a: string, b: string) => a + b.toUpperCase(),
    );

export const rango = (a: number, b: number): string =>
  a === b ? `Junta ${a}` : `Juntas ${a} a ${b}`;

export const normalizar = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
