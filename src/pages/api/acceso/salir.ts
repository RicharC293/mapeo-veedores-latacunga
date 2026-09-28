import type { APIRoute } from "astro";
import { COOKIE_ACCESO } from "../../../lib/auth/roles";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(COOKIE_ACCESO, { path: "/" });
  return redirect("/");
};
