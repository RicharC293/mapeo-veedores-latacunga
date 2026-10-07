import { useEffect, useState } from "preact/hooks";
import {
  ELECCIONES_INICIO,
  calcularCuentaRegresiva,
} from "../../lib/gestion/cuentaRegresiva";

interface Props {
  // Personas que aún faltan para cubrir todos los puestos (del pastel).
  faltan: number;
  // Hora del servidor al renderizar, para que el primer pintado coincida.
  ahoraInicial: number;
}

// Fecha legible, siempre en hora de Ecuador.
const formatoInicio = new Intl.DateTimeFormat("es-EC", {
  timeZone: "America/Guayaquil",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const plural = (n: number, uno: string, varios: string) =>
  `${n} ${n === 1 ? uno : varios}`;

export default function CuentaRegresivaElecciones({
  faltan,
  ahoraInicial,
}: Props) {
  const [ahora, setAhora] = useState(ahoraInicial);

  // Cada 30 s: los segundos no se muestran, así que no hace falta más.
  useEffect(() => {
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const c = calcularCuentaRegresiva(ahora, ELECCIONES_INICIO, faltan);
  const inicio = formatoInicio.format(new Date(ELECCIONES_INICIO));

  return (
    <section class="g-cuenta" aria-labelledby="g-cuenta-titulo">
      <div class="g-cuenta-tiempo">
        <h2 id="g-cuenta-titulo">
          {c.iniciada
            ? "Las elecciones ya iniciaron"
            : "Faltan para las elecciones"}
        </h2>
        {c.iniciada ? null : (
          // role="timer" sin aria-live: el lector de pantalla no repite el
          // cambio cada minuto; lo lee cuando se navega hasta aquí.
          <p class="g-cuenta-cifra" role="timer" aria-live="off">
            {plural(c.dias, "día", "días")}, {plural(c.horas, "hora", "horas")}{" "}
            y {plural(c.minutos, "minuto", "minutos")}
          </p>
        )}
        <p class="g-cuenta-fecha">Inicio: {inicio} (hora de Ecuador)</p>
      </div>
      {c.iniciada ? null : (
        <div class="g-cuenta-ritmo">
          <h3>Ritmo necesario</h3>
          {faltan === 0 ? (
            <p class="g-cuenta-cifra">
              Todos los puestos tienen quién los cubra
            </p>
          ) : (
            <>
              <p class="g-cuenta-cifra">
                {c.esHoy
                  ? `${faltan} personas hoy`
                  : `${plural(c.ritmoPorDia, "persona", "personas")} por día`}
              </p>
              <p class="g-cuenta-fecha">
                Para conseguir las {faltan} que faltan antes de la fecha.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
