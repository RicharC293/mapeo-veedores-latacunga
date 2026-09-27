import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, "../../../data/db");

// Serializa lecturas/escrituras por colección dentro de este proceso para
// evitar una carrera de lectura-modificación-escritura entre peticiones concurrentes.
// Esto es un respaldo local de un solo proceso; Supabase reemplazará esta capa.
const locks = new Map<string, Promise<unknown>>();

function withLock<T>(collection: string, fn: () => T): Promise<T> {
  const previous = locks.get(collection) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  locks.set(
    collection,
    next.catch(() => undefined),
  );
  return next;
}

function pathFor(collection: string): string {
  return resolve(dbDir, `${collection}.json`);
}

function readSync<T>(collection: string): T[] {
  try {
    return JSON.parse(readFileSync(pathFor(collection), "utf8")) as T[];
  } catch {
    return [];
  }
}

function writeSync<T>(collection: string, data: T[]): void {
  mkdirSync(dbDir, { recursive: true });
  writeFileSync(pathFor(collection), JSON.stringify(data, null, 2) + "\n");
}

export function readCollection<T>(collection: string): Promise<T[]> {
  return withLock(collection, () => readSync<T>(collection));
}

export function mutateCollection<T>(
  collection: string,
  fn: (items: T[]) => T[],
): Promise<T[]> {
  return withLock(collection, () => {
    const next = fn(readSync<T>(collection));
    writeSync(collection, next);
    return next;
  });
}
