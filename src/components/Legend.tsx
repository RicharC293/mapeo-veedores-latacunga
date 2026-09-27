export default function Legend() {
  return (
    <div class="legend" aria-hidden="true">
      <span>
        <i class="sw" style={{ background: "var(--urb)" }} />
        Urbana
      </span>
      <span>
        <i class="sw" style={{ background: "var(--rur)" }} />
        Rural
      </span>
      <span>
        <i class="dot" />
        Recinto (tamaño según electores)
      </span>
    </div>
  );
}
