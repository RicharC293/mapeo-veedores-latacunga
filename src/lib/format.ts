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

// Hasta dos iniciales de un nombre, para identificar a la persona de un
// vistazo ("María Fernanda Altamirano" → "MF"). Ignora partículas sueltas.
export const iniciales = (nombres: string): string => {
  const palabras = nombres
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-záéíóúñü]/i.test(w[0] ?? ""));
  const util = palabras.filter((w) => !/^(de|del|la|las|los|y|e)$/i.test(w));
  const fuente = util.length > 0 ? util : palabras;
  return fuente
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
};
