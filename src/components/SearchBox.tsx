import { query, setQuery } from "../lib/state";

export default function SearchBox() {
  return (
    <input
      id="q"
      class="search"
      type="search"
      placeholder="Buscar recinto o dirección"
      aria-label="Buscar recinto o dirección"
      value={query.value}
      onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
    />
  );
}
