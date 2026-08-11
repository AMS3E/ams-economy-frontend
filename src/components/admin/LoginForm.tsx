"use client";

import { useActionState } from "react";
import { css } from "@/styled-system/css";
import { loginAction } from "@/lib/auth/actions";
import { ac } from "./tokens";
import { Surface, Field, Input, Button } from "./ui";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <Surface className={css({ width: "100%", maxWidth: "380px", borderRadius: "16px" })} style={{ boxShadow: ac.shadowMd }}>
      <form action={action} className={css({ padding: "32px" })}>
        {/* Brand — the same lockup the sidebar carries, so the sign-in page and
            the tool behind it are recognisably one product. */}
        <div className={css({ display: "flex", alignItems: "center", gap: "9px", marginBottom: "18px" })}>
          <span
            className={css({ width: "28px", height: "28px", borderRadius: "8px", display: "grid", placeItems: "center", fontSize: "13px", fontWeight: 700, flex: "none" })}
            style={{ background: ac.accent, color: ac.accentFg }}
          >
            A
          </span>
          <span className={css({ display: "flex", flexDirection: "column", lineHeight: 1.15 })}>
            <span className={css({ fontWeight: 700, fontSize: "14px", letterSpacing: "-0.01em" })}>AMS</span>
            <span className={css({ fontSize: "10.5px", letterSpacing: "0.07em", textTransform: "uppercase" })} style={{ color: ac.faint }}>
              Infotainment
            </span>
          </span>
        </div>

        <h1 className={css({ fontSize: "18px", fontWeight: 600, letterSpacing: "-0.01em" })}>Sign in</h1>
        <p className={css({ fontSize: "13px", marginTop: "4px", marginBottom: "22px" })} style={{ color: ac.muted }}>
          Use your WordPress username and password.
        </p>

        <div className={css({ display: "flex", flexDirection: "column", gap: "14px" })}>
          <Field label="Username">
            <Input
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
              disabled={pending}
            />
          </Field>

          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required disabled={pending} />
          </Field>
        </div>

        {state?.error ? (
          <p
            role="alert"
            className={css({ fontSize: "12.5px", marginTop: "16px", padding: "9px 11px", borderRadius: "9px", lineHeight: 1.5 })}
            style={{ color: ac.danger, background: ac.dangerTint, border: `1px solid ${ac.danger}` }}
          >
            {state.error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          className={css({ width: "100%", marginTop: "20px" })}
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Surface>
  );
}
