import { signal } from "@preact/signals";

export type ViewState =
  | { kind: "canton" }
  | { kind: "parroquia"; code: number }
  | { kind: "recinto"; cod: number }
  | { kind: "busqueda"; query: string };

type ZoomTarget =
  | { kind: "canton" }
  | { kind: "parroquia"; code: number }
  | { kind: "recinto"; cod: number };

export const view = signal<ViewState>({ kind: "canton" });
export const query = signal("");
export const zoomRequest = signal<{ target: ZoomTarget; nonce: number } | null>(
  null,
);

let nonce = 0;
function requestZoom(target: ZoomTarget): void {
  nonce += 1;
  zoomRequest.value = { target, nonce };
}

function scrollPanelIfMobile(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (window.innerWidth >= 820) return;
  document
    .querySelector(".panel")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function selectParroquia(code: number, move: boolean): void {
  view.value = { kind: "parroquia", code };
  if (move) {
    requestZoom({ kind: "parroquia", code });
    scrollPanelIfMobile();
  }
}

export function selectRecinto(cod: number, move: boolean): void {
  view.value = { kind: "recinto", cod };
  if (move) {
    requestZoom({ kind: "recinto", cod });
    scrollPanelIfMobile();
  }
}

export function selectCanton(move: boolean): void {
  view.value = { kind: "canton" };
  if (move) requestZoom({ kind: "canton" });
}

export function setQuery(value: string): void {
  query.value = value;
  const t = value.trim();
  view.value = t ? { kind: "busqueda", query: t } : { kind: "canton" };
}
