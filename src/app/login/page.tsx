import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { css } from "@/styled-system/css";
import { ac } from "@/components/admin/tokens";
import LoginForm from "@/components/admin/LoginForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// Top-level route (outside the (site) and /admin shells) so the sign-in screen
// renders on the thin root layout alone — no public nav, no admin sidebar.
//
// Bounce already-signed-in users to /admin here (not in the proxy): getSession()
// validates the token against WordPress, so a stale-but-present cookie correctly
// falls through to the form instead of ping-ponging with the layout's redirect.
export default async function LoginPage() {
  if (await getSession()) redirect("/admin");

  return (
    <main
      className={css({
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      })}
      style={{ background: ac.canvas, color: ac.text }}
    >
      <LoginForm />
    </main>
  );
}
