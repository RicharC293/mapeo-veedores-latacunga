import { supabaseSecret } from "../supabase";
import { mutateCollection, readCollection } from "../gestion/jsonStore";
import { listVeedores } from "../gestion/veedores";
import { listCoordinadores } from "../gestion/coordinadores";
import { listAcreditadosCda } from "../gestion/acreditadosCda";
import type { Contacto, EstadoGuardado } from "./plan";

const COLECCION = "contactos";
// Tablas del Consolidado: confirmar por WhatsApp marca "verificado" en el
// puesto de la persona, el mismo dato que cuentan Cobertura y los informes.
const PUESTOS = ["veedores", "coordinadores", "acreditados_cda"] as const;

export async function listContactos(): Promise<Contacto[]> {
  if (supabaseSecret) {
    const { data, error } = await supabaseSecret.from("contactos").select("*");
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      cedula: r.cedula,
      estado: r.estado as EstadoGuardado,
      intentos: r.intentos,
      ultimoEnvio: r.ultimo_envio,
      puestoEnviado: r.puesto_enviado,
      cedulaRecibida: r.cedula_recibida,
      actualizadoPor: r.actualizado_por,
      actualizadoEn: r.actualizado_en,
    }));
  }
  return readCollection<Contacto>(COLECCION);
}

async function guardar(c: Contacto): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret.from("contactos").upsert(
      {
        cedula: c.cedula,
        estado: c.estado,
        intentos: c.intentos,
        ultimo_envio: c.ultimoEnvio,
        puesto_enviado: c.puestoEnviado,
        cedula_recibida: c.cedulaRecibida,
        actualizado_por: c.actualizadoPor,
        actualizado_en: c.actualizadoEn,
      },
      { onConflict: "cedula" },
    );
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<Contacto>(COLECCION, (items) => [
    ...items.filter((i) => i.cedula !== c.cedula),
    c,
  ]);
}

async function quitar(cedula: string): Promise<void> {
  if (supabaseSecret) {
    const { error } = await supabaseSecret
      .from("contactos")
      .delete()
      .eq("cedula", cedula);
    if (error) throw new Error(error.message);
    return;
  }
  await mutateCollection<Contacto>(COLECCION, (items) =>
    items.filter((i) => i.cedula !== cedula),
  );
}

async function marcarVerificado(
  cedula: string,
  verificado: boolean,
): Promise<void> {
  for (const tabla of PUESTOS) {
    if (supabaseSecret) {
      const { error } = await supabaseSecret
        .from(tabla)
        .update({ verificado })
        .eq("cedula", cedula);
      if (error) throw new Error(error.message);
    } else {
      await mutateCollection<{ cedula: string; verificado: boolean }>(
        tabla,
        (items) =>
          items.map((i) => (i.cedula === cedula ? { ...i, verificado } : i)),
      );
    }
  }
}

// Si la cédula está en el Consolidado y si ya figura verificada en su puesto.
async function enConsolidado(
  cedula: string,
): Promise<{ esta: boolean; verificado: boolean }> {
  const [v, c, a] = await Promise.all([
    listVeedores(),
    listCoordinadores(),
    listAcreditadosCda(),
  ]);
  const suyos = [...v, ...c, ...a].filter((p) => p.cedula.trim() === cedula);
  return {
    esta: suyos.length > 0,
    verificado: suyos.some((p) => p.verificado),
  };
}

export type AccionContacto =
  | { accion: "enviado"; puesto: string }
  | { accion: "confirmado"; puesto: string }
  | { accion: "numero_equivocado" }
  | { accion: "pendiente" }
  | { accion: "cedula"; recibida: boolean };

export async function registrarContacto(
  cedula: string,
  a: AccionContacto,
  usuario: string,
): Promise<Contacto | null> {
  const { esta, verificado } = await enConsolidado(cedula);
  if (!esta) throw new Error("Esa cédula no está en el Consolidado.");
  const previo = (await listContactos()).find((c) => c.cedula === cedula);
  const ahora = new Date().toISOString();
  // Quien ya estaba verificado antes de este módulo cuenta como confirmado.
  const confirmadoAntes = previo ? previo.estado === "confirmado" : verificado;
  const base: Contacto = previo ?? {
    cedula,
    estado: confirmadoAntes ? "confirmado" : "enviado",
    intentos: 0,
    ultimoEnvio: null,
    puestoEnviado: null,
    cedulaRecibida: false,
    actualizadoPor: null,
    actualizadoEn: ahora,
  };
  const firma = { actualizadoPor: usuario, actualizadoEn: ahora };

  if (a.accion === "pendiente") {
    await quitar(cedula);
    if (confirmadoAntes) await marcarVerificado(cedula, false);
    return null;
  }

  let nuevo: Contacto;
  if (a.accion === "enviado") {
    // Reenviar a quien ya confirmó ese mismo puesto no le quita la
    // confirmación; si cambió de puesto, tiene que volver a confirmar.
    const sigue =
      confirmadoAntes &&
      (base.puestoEnviado === null || base.puestoEnviado === a.puesto);
    nuevo = {
      ...base,
      ...firma,
      estado: sigue ? "confirmado" : "enviado",
      intentos: base.intentos + 1,
      ultimoEnvio: ahora,
      puestoEnviado: a.puesto,
    };
    if (confirmadoAntes && !sigue) await marcarVerificado(cedula, false);
  } else if (a.accion === "confirmado") {
    nuevo = {
      ...base,
      ...firma,
      estado: "confirmado",
      puestoEnviado: a.puesto,
    };
    await marcarVerificado(cedula, true);
  } else if (a.accion === "numero_equivocado") {
    nuevo = { ...base, ...firma, estado: "numero_equivocado" };
    if (confirmadoAntes) await marcarVerificado(cedula, false);
  } else {
    if (!previo && !confirmadoAntes) {
      throw new Error("Primero envía el mensaje por WhatsApp.");
    }
    nuevo = { ...base, ...firma, cedulaRecibida: a.recibida };
  }
  await guardar(nuevo);
  return nuevo;
}
