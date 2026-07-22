import { redirect } from "next/navigation";

/** Legacy URL; the admin UI lives under `/admin`. */
export default function AjmeraAdminRedirect() {
  redirect("/admin");
}
