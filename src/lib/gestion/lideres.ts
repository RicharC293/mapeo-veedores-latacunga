import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { cedulaValida, normalizarCedula } from "./cedula";
import { rowToLider } from "./rows";
import type { Database } from "../database.types";
import { CUPO_CARGO, type AmbitoLider, type Cargo, type Lider } from "./types";

type LiderUpdate = Database["public"]["Tables"]["lideres"]["Update"];

const COLLECTION = "lideres";

// Cargos de alcance cantonal: no están atados a una sola parroquia.
const CARGO_CANTONAL: Cargo[] = [
  "alcalde",
  "concejal_urbano",
  "concejal_rural",
];

const MENSAJE_CARGO: Record<Cargo, string> = {
  alcalde: "Ya existe un alcalde registrado.",
  concejal_urbano: `Ya se alcanzó el máximo de ${CUPO_CARGO.concejal_urbano} concejales urbanos.`,
  concejal_rural: `Ya se alcanzó el máximo de ${CUPO_CARGO.concejal_rural} concejales rurales.`,
  vocal_junta_parroquial: "Esta parroquia ya tiene un vocal asignado.",
};

// Solo para el respaldo JSON local (sin Supabase): replica los cupos que en
// Supabase aplica el trigger validar_cargo_lider (misma migración
// dignidades.sql). idExcluir evita que una edición se cuente contra sí misma.
function validarCupoCargo(
  existentes: Lider[],
  cargo: Cargo | null,
  parroquiaCodigo: number | null,
  idExcluir?: string,
) {
  if (!cargo) return;
  const delCargo = existentes.filter(
    (l) => l.cargo === cargo && l.id !== idExcluir,
  );
  if (cargo === "vocal_junta_parroquial") {
    if (parroquiaCodigo == null) {
      throw new Error("Debe indicar la parroquia del vocal.");
    }
    if (delCargo.some((l) => l.parroquiaCodigo === parroquiaCodigo)) {
      throw new Error(MENSAJE_CARGO.vocal_junta_parroquial);
    }
    return;
  }
  if (delCargo.length >= CUPO_CARGO[cargo]) {
    throw new Error(MENSAJE_CARGO[cargo]);
  }
}

// La tabla exige ambito='parroquia' <=> parroquia_codigo no nulo (constraint
// lideres_parroquia_segun_ambito), así que "ambito" no es un input libre: se
// deriva de si el resultado final necesita una parroquia. Un cargo cantonal
// (alcalde/concejal) nunca la necesita, aunque el ambito recibido diga
// "parroquia"; un vocal siempre la necesita, aunque el ambito recibido diga
// "general". "candidato" es la excepción: solo se respeta si no hay cargo
// (quien ya ostenta una dignidad deja de ser candidato) y entonces no usa
// parroquia_codigo ni recintos, sino la lista parroquiaCodigos.
function resolverAsignacion(input: {
  ambito: AmbitoLider;
  parroquiaCodigo: number | null;
  parroquiaCodigos: number[];
  recintoCodigos: number[];
  cargo: Cargo | null;
}): {
  ambito: AmbitoLider;
  parroquiaCodigo: number | null;
  parroquiaCodigos: number[];
  recintoCodigos: number[];
} {
  if (input.cargo == null && input.ambito === "candidato") {
    return {
      ambito: "candidato",
      parroquiaCodigo: null,
      parroquiaCodigos: [...new Set(input.parroquiaCodigos)],
      recintoCodigos: [],
    };
  }

  const cantonal = input.cargo != null && CARGO_CANTONAL.includes(input.cargo);
  const esVocal = input.cargo === "vocal_junta_parroquial";
  const usaParroquia = esVocal || (!cantonal && input.ambito === "parroquia");

  const parroquiaCodigo = usaParroquia ? input.parroquiaCodigo : null;
  const recintoCodigos =
    usaParroquia || input.cargo != null ? input.recintoCodigos : [];
  const ambito: AmbitoLider = parroquiaCodigo != null ? "parroquia" : "general";

  return { ambito, parroquiaCodigo, parroquiaCodigos: [], recintoCodigos };
}

export async function listLideres(): Promise<Lider[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret.from("lideres").select("*");
    if (error) throw new Error(error.message);
    return data.map(rowToLider);
  }
  return readCollection<Lider>(COLLECTION);
}

export async function agregarLider(input: {
  cedula: string | null;
  nombres: string;
  telefono: string;
  organizacion: string;
  ambito: AmbitoLider;
  parroquiaCodigo: number | null;
  parroquiaCodigos: number[];
  recintoCodigos: number[];
  cargo: Cargo | null;
}): Promise<Lider> {
  // La cédula es opcional (rol organizativo, no electoral): solo se valida
  // el formato cuando sí se ingresa.
  const cedulaInput = input.cedula?.trim() || null;
  const cedula = cedulaInput ? normalizarCedula(cedulaInput) : null;
  if (cedula && !cedulaValida(cedula))
    throw new Error("Cédula inválida: debe tener 10 dígitos.");
  if (!input.nombres.trim()) throw new Error("El nombre es obligatorio.");

  const resuelto = resolverAsignacion(input);
  if (resuelto.ambito === "parroquia" && resuelto.parroquiaCodigo == null) {
    throw new Error("Debe indicar la parroquia del líder.");
  }

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("lideres")
      .insert({
        cedula,
        nombres: input.nombres.trim(),
        telefono: input.telefono.trim(),
        organizacion: input.organizacion.trim(),
        ambito: resuelto.ambito,
        parroquia_codigo: resuelto.parroquiaCodigo,
        parroquia_codigos: resuelto.parroquiaCodigos,
        recinto_codigos: resuelto.recintoCodigos,
        cargo: input.cargo,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505")
        throw new Error("Esta cédula ya está registrada como líder.");
      throw new Error(error.message);
    }
    return rowToLider(data);
  }

  let creado: Lider | null = null;
  await mutateCollection<Lider>(COLLECTION, (items) => {
    if (cedula && items.some((l) => l.cedula === cedula)) {
      throw new Error("Esta cédula ya está registrada como líder.");
    }
    validarCupoCargo(items, input.cargo, resuelto.parroquiaCodigo);
    const lider: Lider = {
      id: randomUUID(),
      cedula,
      nombres: input.nombres.trim(),
      telefono: input.telefono.trim(),
      organizacion: input.organizacion.trim(),
      ambito: resuelto.ambito,
      parroquiaCodigo: resuelto.parroquiaCodigo,
      parroquiaCodigos: resuelto.parroquiaCodigos,
      recintoCodigos: resuelto.recintoCodigos,
      cargo: input.cargo,
      foto: null,
      creadoEn: new Date().toISOString(),
    };
    creado = lider;
    return [...items, lider];
  });
  return creado!;
}

type LiderPatch = Partial<
  Pick<
    Lider,
    | "nombres"
    | "telefono"
    | "organizacion"
    | "parroquiaCodigo"
    | "parroquiaCodigos"
    | "recintoCodigos"
    | "ambito"
    | "cargo"
  >
>;

// true si el patch toca algo que afecta la asignación de parroquia/recintos,
// y por lo tanto hay que re-derivar ambito con resolverAsignacion.
function tocaAsignacion(patch: LiderPatch): boolean {
  return (
    patch.cargo !== undefined ||
    patch.parroquiaCodigo !== undefined ||
    patch.parroquiaCodigos !== undefined ||
    patch.recintoCodigos !== undefined ||
    patch.ambito !== undefined
  );
}

export async function editarLider(
  id: string,
  patch: LiderPatch,
): Promise<Lider> {
  if (supabaseSecret) {
    const dbPatch: LiderUpdate = {};
    if (patch.nombres !== undefined) dbPatch.nombres = patch.nombres;
    if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
    if (patch.organizacion !== undefined)
      dbPatch.organizacion = patch.organizacion;

    if (tocaAsignacion(patch)) {
      const { data: actual, error: errActual } = await supabaseSecret
        .from("lideres")
        .select("*")
        .eq("id", id)
        .single();
      if (errActual) throw new Error(errActual.message);
      const base = rowToLider(actual);
      const cargo = patch.cargo !== undefined ? patch.cargo : base.cargo;
      const resuelto = resolverAsignacion({
        ambito: patch.ambito ?? base.ambito,
        parroquiaCodigo:
          patch.parroquiaCodigo !== undefined
            ? patch.parroquiaCodigo
            : base.parroquiaCodigo,
        parroquiaCodigos: patch.parroquiaCodigos ?? base.parroquiaCodigos,
        recintoCodigos: patch.recintoCodigos ?? base.recintoCodigos,
        cargo,
      });
      if (resuelto.ambito === "parroquia" && resuelto.parroquiaCodigo == null) {
        throw new Error("Debe indicar la parroquia del líder.");
      }
      dbPatch.ambito = resuelto.ambito;
      dbPatch.parroquia_codigo = resuelto.parroquiaCodigo;
      dbPatch.parroquia_codigos = resuelto.parroquiaCodigos;
      dbPatch.recinto_codigos = resuelto.recintoCodigos;
      dbPatch.cargo = cargo;
    }

    const { data, error } = await supabaseSecret
      .from("lideres")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToLider(data);
  }

  let actualizado: Lider | null = null;
  await mutateCollection<Lider>(COLLECTION, (items) => {
    const actual = items.find((l) => l.id === id);
    if (!actual) throw new Error("No se encontró el líder.");
    let fusionado: Lider = { ...actual, ...patch };
    if (tocaAsignacion(patch)) {
      const resuelto = resolverAsignacion({
        ambito: fusionado.ambito,
        parroquiaCodigo: fusionado.parroquiaCodigo,
        parroquiaCodigos: fusionado.parroquiaCodigos,
        recintoCodigos: fusionado.recintoCodigos,
        cargo: fusionado.cargo,
      });
      if (resuelto.ambito === "parroquia" && resuelto.parroquiaCodigo == null) {
        throw new Error("Debe indicar la parroquia del líder.");
      }
      fusionado = { ...fusionado, ...resuelto };
    }
    validarCupoCargo(items, fusionado.cargo, fusionado.parroquiaCodigo, id);
    actualizado = fusionado;
    return items.map((l) => (l.id === id ? fusionado : l));
  });
  if (!actualizado) throw new Error("No se encontró el líder.");
  return actualizado;
}

export async function actualizarFotoLider(
  id: string,
  foto: string,
): Promise<Lider> {
  if (!supabaseSecret) {
    throw new Error(
      "Subir fotos requiere Supabase configurado; no está disponible en modo local.",
    );
  }
  const { data, error } = await supabaseSecret
    .from("lideres")
    .update({ foto })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToLider(data);
}

export async function eliminarLider(id: string): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("lideres")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<Lider>(COLLECTION, (items) =>
    items.filter((l) => l.id !== id),
  );
}
