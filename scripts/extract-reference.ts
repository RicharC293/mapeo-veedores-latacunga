// Saca las constantes PARR, BASE y RECS del prototipo HTML de referencia
// y las guarda como archivos JSON/GeoJSON semilla en data/seed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const referencePath = resolve(root, "reference/mapa-recintos-latacunga.html");
const seedDir = resolve(root, "data/seed");

function extractConst(source: string, name: string): unknown {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  if (start === -1)
    throw new Error(`No se encontró "const ${name}" en el HTML de referencia.`);
  const valueStart = start + marker.length;
  const end = source.indexOf(`;\n`, valueStart);
  if (end === -1) throw new Error(`No se encontró el fin de "const ${name}".`);
  const raw = source.slice(valueStart, end);
  return JSON.parse(raw);
}

const html = readFileSync(referencePath, "utf8");

const PARR = extractConst(html, "PARR");
const BASE = extractConst(html, "BASE");
const RECS = extractConst(html, "RECS") as Array<{
  jf: number;
  jm: number;
  jt: number;
  el: number;
}>;

mkdirSync(seedDir, { recursive: true });
writeFileSync(
  resolve(seedDir, "parroquias.geojson"),
  JSON.stringify(PARR, null, 2) + "\n",
);
writeFileSync(
  resolve(seedDir, "base.geojson"),
  JSON.stringify(BASE, null, 2) + "\n",
);
writeFileSync(
  resolve(seedDir, "recintos.json"),
  JSON.stringify(RECS, null, 2) + "\n",
);

const totales = RECS.reduce(
  (a, r) => ({
    el: a.el + r.el,
    jt: a.jt + r.jt,
    jf: a.jf + r.jf,
    jm: a.jm + r.jm,
  }),
  { el: 0, jt: 0, jf: 0, jm: 0 },
);
const parroquias = (PARR as { features: unknown[] }).features.length;

console.log(`Extraído a data/seed/:`);
console.log(`  ${parroquias} parroquias`);
console.log(`  ${RECS.length} recintos`);
console.log(`  ${totales.el.toLocaleString("es-EC")} electores`);
console.log(`  ${totales.jt} juntas (${totales.jf} F, ${totales.jm} M)`);
