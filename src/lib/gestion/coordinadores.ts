import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { cedulaValida, normalizarCedula } from "./cedula";
import { resolverEmail } from "./email";
import { estaEnListaNegra, agregarAListaNegra } from "./listaNegra";
import { registrarEvento } from "./eventos";
import { rowToCoordinador } from "./rows";
import type { Coordinador } from "./types";

const COLLECTION = "coordinadores";

export async function listCoordinadores(): Promise<Coordinador[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("coordinadores")
      .select("*");
    if (error) throw new Error(error.message);
    return data.map(rowToCoordinador);
  }
  return readCollection<Coordinador>(COLLECTION);
}

export async function coordinadoresPorRecinto(
  recintoCodigo: number,
): Promise<{ titular: Coordinador | null; suplentes: Coordinador[] }> {
  const items = (await listCoordinadores()).filter(
    (c) => c.recintoCodigo === recintoCodigo,
  );
  return {
    titular: items.find((c) => c.tipo === "titular") ?? null,
    suplentes: items
      .filter((c) => c.tipo === "suplente")
      .sort((a, b) => a.orden - b.orden),
  };
}

export async function agregarCoordinador(input: {
  cedula: string;
  nombres: string;
  telefono: string;
  email?: string;
  responsableLiderId: string | null;
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: "titular" | "suplente";
}): Promise<Coordinador> {
  const cedula = normalizarCedula(input.cedula);
  if (!cedulaValida(cedula))
    throw new Error("Cédula inválida: debe tener 10 dígitos.");
  if (!input.nombres.trim()) throw new Error("El nombre es obligatorio.");
  const email = resolverEmail(input.email);

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret.rpc("agregar_coordinador", {
      p_cedula: cedula,
      p_nombres: input.nombres,
      p_telefono: input.telefono,
      p_email: email,
      p_recinto_codigo: input.recintoCodigo,
      p_parroquia_codigo: input.parroquiaCodigo,
      p_tipo: input.tipo,
      // La función SQL acepta NULL para p_responsable_lider_id, pero el
      // generador de tipos de Supabase no marca los parámetros como
      // anulables (solo detecta opcionalidad por valores por defecto).
      p_responsable_lider_id: input.responsableLiderId as string,
    });
    if (error) throw new Error(error.message);
    return rowToCoordinador(data);
  }

  if (await estaEnListaNegra(cedula)) {
    throw new Error(
      "Esta cédula está en la lista negra y no puede registrarse.",
    );
  }

  let creado: Coordinador | null = null;
  await mutateCollection<Coordinador>(COLLECTION, (items) => {
    if (items.some((c) => c.cedula === cedula)) {
      throw new Error("Esta cédula ya está registrada como coordinador.");
    }
    const delRecinto = items.filter(
      (c) => c.recintoCodigo === input.recintoCodigo,
    );
    if (
      input.tipo === "titular" &&
      delRecinto.some((c) => c.tipo === "titular")
    ) {
      throw new Error(
        "Este recinto ya tiene un coordinador titular. Desvincúlelo primero.",
      );
    }
    const orden =
      input.tipo === "titular"
        ? 0
        : Math.max(
            0,
            ...delRecinto
              .filter((c) => c.tipo === "suplente")
              .map((c) => c.orden),
          ) + 1;
    const coordinador: Coordinador = {
      id: randomUUID(),
      cedula,
      nombres: input.nombres.trim(),
      telefono: input.telefono.trim(),
      email,
      responsableLiderId: input.responsableLiderId,
      recintoCodigo: input.recintoCodigo,
      parroquiaCodigo: input.parroquiaCodigo,
      tipo: input.tipo,
      orden,
      verificado: false,
      creadoEn: new Date().toISOString(),
    };
    creado = coordinador;
    return [...items, coordinador];
  });

  await registrarEvento({
    tipo: "alta_coordinador",
    cedula,
    recintoCodigo: input.recintoCodigo,
    parroquiaCodigo: input.parroquiaCodigo,
  });
  return creado!;
}

export async function desvincularCoordinador(
  id: string,
  motivo: string | null,
  listaNegra = true,
): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret.rpc("desvincular_coordinador", {
      p_id: id,
      // La función SQL acepta NULL para p_motivo, pero el generador de tipos
      // de Supabase no marca los parámetros como anulables (solo detecta
      // opcionalidad por valores por defecto).
      p_motivo: motivo as string,
      p_lista_negra: listaNegra,
    });
    if (error) throw new Error(error.message);
    return;
  }

  let desvinculado: Coordinador | null = null;

  // La promoción de un suplente a titular es un cambio de rol, no una alta neta:
  // esa persona ya cuenta como coordinador activo desde que se registró como suplente,
  // así que no se registra un nuevo evento "alta_coordinador" para ella.
  await mutateCollection<Coordinador>(COLLECTION, (items) => {
    const coordinador = items.find((c) => c.id === id);
    if (!coordinador) throw new Error("No se encontró el coordinador.");
    desvinculado = coordinador;

    const resto = items.filter((c) => c.id !== id);

    if (coordinador.tipo !== "titular") {
      const demas = resto
        .filter(
          (c) =>
            c.recintoCodigo === coordinador.recintoCodigo &&
            c.tipo === "suplente" &&
            c.orden > coordinador.orden,
        )
        .sort((a, b) => a.orden - b.orden);
      return resto.map((c) => {
        const idx = demas.findIndex((d) => d.id === c.id);
        return idx === -1 ? c : { ...c, orden: c.orden - 1 };
      });
    }

    const suplentes = resto
      .filter(
        (c) =>
          c.recintoCodigo === coordinador.recintoCodigo &&
          c.tipo === "suplente",
      )
      .sort((a, b) => a.orden - b.orden);
    if (suplentes.length === 0) return resto;

    const [siguiente, ...demas] = suplentes;
    const nuevoTitular: Coordinador = {
      ...siguiente,
      tipo: "titular",
      orden: 0,
    };
    return resto.map((c) => {
      if (c.id === nuevoTitular.id) return nuevoTitular;
      const idx = demas.findIndex((d) => d.id === c.id);
      return idx === -1 ? c : { ...c, orden: idx + 1 };
    });
  });

  if (!desvinculado) return;
  const d = desvinculado as Coordinador;

  if (listaNegra) {
    await agregarAListaNegra({
      cedula: d.cedula,
      nombres: d.nombres,
      telefono: d.telefono,
      motivo,
      origen: "coordinador",
    });
  }
  await registrarEvento({
    tipo: "baja_coordinador",
    cedula: d.cedula,
    recintoCodigo: d.recintoCodigo,
    parroquiaCodigo: d.parroquiaCodigo,
  });
}

export async function marcarVerificadoCoordinador(
  id: string,
  verificado: boolean,
): Promise<Coordinador> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret
      .from("coordinadores")
      .update({ verificado })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToCoordinador(data);
  }

  let actualizado: Coordinador | null = null;
  await mutateCollection<Coordinador>(COLLECTION, (items) =>
    items.map((c) => {
      if (c.id !== id) return c;
      actualizado = { ...c, verificado };
      return actualizado;
    }),
  );
  if (!actualizado) throw new Error("No se encontró el coordinador.");
  return actualizado;
}
