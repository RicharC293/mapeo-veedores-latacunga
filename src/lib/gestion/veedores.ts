import { randomUUID } from "node:crypto";
import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "./jsonStore";
import { cedulaValida, normalizarCedula } from "./cedula";
import { estaEnListaNegra, agregarAListaNegra } from "./listaNegra";
import { registrarEvento } from "./eventos";
import { rowToVeedor } from "./rows";
import type { Veedor } from "./types";

const COLLECTION = "veedores";

export async function listVeedores(): Promise<Veedor[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret.from("veedores").select("*");
    if (error) throw new Error(error.message);
    return data.map(rowToVeedor);
  }
  return readCollection<Veedor>(COLLECTION);
}

export async function veedoresPorJunta(
  juntaId: string,
): Promise<{ titular: Veedor | null; suplentes: Veedor[] }> {
  const items = (await listVeedores()).filter((v) => v.juntaId === juntaId);
  return {
    titular: items.find((v) => v.tipo === "titular") ?? null,
    suplentes: items
      .filter((v) => v.tipo === "suplente")
      .sort((a, b) => a.orden - b.orden),
  };
}

export async function agregarVeedor(input: {
  cedula: string;
  nombres: string;
  telefono: string;
  juntaId: string;
  recintoCodigo: number;
  parroquiaCodigo: number;
  tipo: "titular" | "suplente";
}): Promise<Veedor> {
  const cedula = normalizarCedula(input.cedula);
  if (!cedulaValida(cedula))
    throw new Error("Cédula inválida: debe tener 10 dígitos.");
  if (!input.nombres.trim()) throw new Error("El nombre es obligatorio.");

  if (supabaseSecret) {
    const { data, error } = await supabaseSecret.rpc("agregar_veedor", {
      p_cedula: cedula,
      p_nombres: input.nombres,
      p_telefono: input.telefono,
      p_junta_id: input.juntaId,
      p_recinto_codigo: input.recintoCodigo,
      p_parroquia_codigo: input.parroquiaCodigo,
      p_tipo: input.tipo,
    });
    if (error) throw new Error(error.message);
    return rowToVeedor(data);
  }

  if (await estaEnListaNegra(cedula)) {
    throw new Error(
      "Esta cédula está en la lista negra y no puede registrarse.",
    );
  }

  let creado: Veedor | null = null;
  await mutateCollection<Veedor>(COLLECTION, (items) => {
    if (items.some((v) => v.cedula === cedula)) {
      throw new Error("Esta cédula ya está registrada como veedor.");
    }
    const deLaJunta = items.filter((v) => v.juntaId === input.juntaId);
    if (
      input.tipo === "titular" &&
      deLaJunta.some((v) => v.tipo === "titular")
    ) {
      throw new Error(
        "Esta junta ya tiene un veedor titular. Desvincúlelo primero.",
      );
    }
    const orden =
      input.tipo === "titular"
        ? 0
        : Math.max(
            0,
            ...deLaJunta
              .filter((v) => v.tipo === "suplente")
              .map((v) => v.orden),
          ) + 1;
    const veedor: Veedor = {
      id: randomUUID(),
      cedula,
      nombres: input.nombres.trim(),
      telefono: input.telefono.trim(),
      juntaId: input.juntaId,
      recintoCodigo: input.recintoCodigo,
      parroquiaCodigo: input.parroquiaCodigo,
      tipo: input.tipo,
      orden,
      creadoEn: new Date().toISOString(),
    };
    creado = veedor;
    return [...items, veedor];
  });

  await registrarEvento({
    tipo: "alta_veedor",
    cedula,
    recintoCodigo: input.recintoCodigo,
    parroquiaCodigo: input.parroquiaCodigo,
  });
  return creado!;
}

export async function desvincularVeedor(
  id: string,
  motivo: string | null,
): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret.rpc("desvincular_veedor", {
      p_id: id,
      // La función SQL acepta NULL para p_motivo, pero el generador de tipos
      // de Supabase no marca los parámetros como anulables (solo detecta
      // opcionalidad por valores por defecto).
      p_motivo: motivo as string,
    });
    if (error) throw new Error(error.message);
    return;
  }

  let desvinculado: Veedor | null = null;

  // La promoción de un suplente a titular es un cambio de rol, no una alta neta:
  // esa persona ya cuenta como veedor activo desde que se registró como suplente,
  // así que no se registra un nuevo evento "alta_veedor" para ella.
  await mutateCollection<Veedor>(COLLECTION, (items) => {
    const veedor = items.find((v) => v.id === id);
    if (!veedor) throw new Error("No se encontró el veedor.");
    desvinculado = veedor;

    const resto = items.filter((v) => v.id !== id);

    if (veedor.tipo !== "titular") {
      const demas = resto
        .filter(
          (v) =>
            v.juntaId === veedor.juntaId &&
            v.tipo === "suplente" &&
            v.orden > veedor.orden,
        )
        .sort((a, b) => a.orden - b.orden);
      return resto.map((v) => {
        const idx = demas.findIndex((d) => d.id === v.id);
        return idx === -1 ? v : { ...v, orden: v.orden - 1 };
      });
    }

    const suplentes = resto
      .filter((v) => v.juntaId === veedor.juntaId && v.tipo === "suplente")
      .sort((a, b) => a.orden - b.orden);
    if (suplentes.length === 0) return resto;

    const [siguiente, ...demas] = suplentes;
    const nuevoTitular: Veedor = { ...siguiente, tipo: "titular", orden: 0 };
    return resto.map((v) => {
      if (v.id === nuevoTitular.id) return nuevoTitular;
      const idx = demas.findIndex((d) => d.id === v.id);
      return idx === -1 ? v : { ...v, orden: idx + 1 };
    });
  });

  if (!desvinculado) return;
  const d = desvinculado as Veedor;

  await agregarAListaNegra({
    cedula: d.cedula,
    nombres: d.nombres,
    telefono: d.telefono,
    motivo,
    origen: "veedor",
  });
  await registrarEvento({
    tipo: "baja_veedor",
    cedula: d.cedula,
    recintoCodigo: d.recintoCodigo,
    parroquiaCodigo: d.parroquiaCodigo,
  });
}
