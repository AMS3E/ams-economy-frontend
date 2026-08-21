"use client";

import { useState } from "react";
import { css } from "@/styled-system/css";
import { ac } from "./tokens";
import { PageHeader, FormCard, FormGrid, Field, Input, Textarea, Badge, SaveBar, type SaveMessage } from "./ui";
import type { Profile } from "@/lib/admin/settings";
import { saveProfile } from "@/lib/admin/screen-actions";

export default function ProfileForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [email, setEmail] = useState(profile.email);
  const [bio, setBio] = useState(profile.description);
  const [url, setUrl] = useState(profile.url);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<SaveMessage | null>(null);

  const save = async () => {
    if (newPass && newPass !== confirmPass) {
      setMsg({ kind: "err", text: "The new passwords don't match." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await saveProfile({
      name,
      first_name: firstName,
      last_name: lastName,
      email,
      description: bio,
      url,
      ...(newPass ? { password: newPass } : {}),
    });
    setBusy(false);
    if (res.ok) {
      setNewPass("");
      setConfirmPass("");
      setMsg({ kind: "ok", text: "Saved" });
    } else {
      setMsg({ kind: "err", text: res.error ?? "Save failed." });
    }
  };

  return (
    <div className={css({ maxWidth: "760px" })}>
      <PageHeader trail={[{ label: "Account" }, { label: "Profile" }]} title="Profile" sub="How you appear across the site." />

      <div className={css({ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" })}>
        <FormCard title="Account" sub="Your byline and the details on your author page.">
          <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
            <div className={css({ display: "flex", alignItems: "center", gap: "16px" })}>
              <div
                className={css({ width: "56px", height: "56px", borderRadius: "16px", display: "grid", placeItems: "center", fontSize: "18px", fontWeight: 600, flex: "none" })}
                style={{ background: ac.surfaceSunken, border: `1px solid ${ac.border}`, color: ac.muted }}
              >
                {profile.initials}
              </div>
              <div className={css({ fontSize: "12.5px" })} style={{ color: ac.muted }}>
                Avatar is managed in WordPress for now.
              </div>
            </div>

            <Field label="Display name" hint="The byline readers see.">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <FormGrid>
              <Field label="First name">
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Field>
              <Field label="Last name">
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
            </FormGrid>

            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>

            <Field label="Bio" hint="Shown on your author page.">
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="A short introduction…" />
            </Field>

            <Field label="Website">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className={css({ fontFamily: "ui-monospace, monospace", fontSize: "12.5px" })}
              />
            </Field>
          </div>
        </FormCard>

        <FormCard title="Account details" sub="Set in WordPress — shown here so you know which account you are signed in as.">
          <div className={css({ display: "flex", flexDirection: "column", gap: "12px" })}>
            <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" })}>
              <span className={css({ fontSize: "12.5px" })} style={{ color: ac.muted }}>
                Username
              </span>
              <span className={css({ fontSize: "12.5px" })} style={{ fontFamily: "ui-monospace, monospace" }}>
                {profile.username}
              </span>
            </div>
            <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" })}>
              <span className={css({ fontSize: "12.5px" })} style={{ color: ac.muted }}>
                Role
              </span>
              <Badge>{profile.roleLabel}</Badge>
            </div>
          </div>
        </FormCard>

        <FormCard title="Password" sub="Leave both blank to keep your current password.">
          <FormGrid>
            <Field label="New password">
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" />
            </Field>
          </FormGrid>
        </FormCard>

        <SaveBar busy={busy} onSave={() => void save()} message={msg} />
      </div>
    </div>
  );
}
