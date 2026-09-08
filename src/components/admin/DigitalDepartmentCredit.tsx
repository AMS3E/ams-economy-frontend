"use client";

import { useEffect, useRef, useState } from "react";
import { css } from "@/styled-system/css";
import { ac } from "./tokens";
import { Icon } from "./icons";

// The sign-in credit line + team card, matching the pattern already live on
// the sister Infotainment admin's login screen. There is no shared package
// between the Next.js frontends, so the roster is plain data here — update it
// by hand if Digital Department's line-up changes.
//
// The card itself is a fixed dark "brand moment" independent of the admin's
// light/dark theme (unlike the rest of the login screen), matching the
// reference: violet/crimson/gold, the AMS mark's own range, not the admin's
// neutral+teal system.

type Member = { honorific: string; name: string; title: string; note?: string; photo: string };

const LEAD: Member = { honorific: "Mr.", name: "SAY Prumny", title: "Deputy Head of Digital", photo: "/team/say-prumny.webp" };

const CHAIN: Member[] = [
  { honorific: "Mr.", name: "CHHIN Pov", title: "Lead Web Developer", note: "Economy + Education Admin Dashboard Developer", photo: "/team/chhin-pov.webp" },
  { honorific: "Mr.", name: "SOTH Kimleng", title: "Full-Stack Developer", note: "Infotainment Admin Dashboard Developer", photo: "/team/soth-kimleng.webp" },
];

const JUNIORS: Member[] = [
  { honorific: "Ms.", name: "HENG PenhPonleu", title: "Junior Web Developer", photo: "/team/heng-penhponleu.webp" },
  { honorific: "Mr.", name: "KEA Daron", title: "Junior Full-Stack Developer", photo: "/team/kea-daron.webp" },
  { honorific: "Mr.", name: "SOEURN Visal", title: "Junior Full-Stack Developer", photo: "/team/soeurn-visal.webp" },
];

const GOLD = "#e6a23c";
const CRIMSON = "#b4293f";
const RING = `linear-gradient(135deg, ${GOLD}, ${CRIMSON}, #59174D)`;
const STEM = `linear-gradient(${GOLD}, ${CRIMSON})`;

function Avatar({ name, photo }: { name: string; photo: string }) {
  return (
    <div className={css({ width: "84px", height: "84px", borderRadius: "50%", padding: "3px", flex: "none" })} style={{ background: RING }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- six static 512px cut-outs under /public/team; nothing for next/image to optimise */}
      <img
        src={photo}
        alt={name}
        width={512}
        height={512}
        decoding="async"
        className={css({ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" })}
        style={{ border: "3px solid #0c0c0e" }}
      />
    </div>
  );
}

function Node({ member }: { member: Member }) {
  return (
    <div className={css({ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", width: "160px" })}>
      <Avatar name={member.name} photo={member.photo} />
      <div className={css({ textAlign: "center" })}>
        <div className={css({ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em" })} style={{ color: "#8a8a94" }}>
          {member.honorific}
        </div>
        <div className={css({ fontSize: "15px", fontWeight: 700 })} style={{ color: "#fff" }}>
          {member.name}
        </div>
        <div className={css({ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "2px" })} style={{ color: GOLD }}>
          {member.title}
        </div>
        {member.note ? (
          <div className={css({ fontSize: "11px", marginTop: "2px" })} style={{ color: "#8a8a94" }}>
            ({member.note})
          </div>
        ) : null}
      </div>
    </div>
  );
}

const stemClass = css({ width: "2px", height: "28px" });

// Exported so the public site footer's own "Digital Department" credit can
// open the same team card (see SiteFooter.tsx) instead of duplicating it.
export function CreditModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      className={css({ position: "fixed", inset: 0, zIndex: 1000050, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" })}
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Digital Department"
        onClick={(e) => e.stopPropagation()}
        className={css({ position: "relative", width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto", borderRadius: "18px", padding: "36px 32px 44px" })}
        style={{
          background: "radial-gradient(120% 90% at 50% -10%, rgba(180,41,63,0.35), rgba(12,12,14,0) 60%), #0c0c0e",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={css({
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background .15s",
            _hover: { background: "rgba(255,255,255,0.12)" },
          })}
          style={{ color: "#c8c8ce", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Icon name="x" size={15} strokeWidth={2} />
        </button>

        <div className={css({ fontSize: "12px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" })} style={{ color: GOLD }}>
          Apsara Media Services
        </div>
        <h2 className={css({ fontSize: "30px", fontWeight: 800, marginTop: "6px" })} style={{ color: "#fff" }}>
          Digital Department
        </h2>
        <div className={css({ height: "1px", marginTop: "18px", marginBottom: "30px" })} style={{ background: `linear-gradient(90deg, ${GOLD}, rgba(180,41,63,0.15))` }} />

        <div className={css({ display: "flex", flexDirection: "column", alignItems: "center" })}>
          <Node member={LEAD} />
          {CHAIN.map((m) => (
            <div key={m.name} className={css({ display: "flex", flexDirection: "column", alignItems: "center" })}>
              <div className={stemClass} style={{ background: STEM }} />
              <Node member={m} />
            </div>
          ))}

          <div className={stemClass} style={{ background: STEM }} />
          <div className={css({ position: "relative", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px", width: "100%", paddingTop: "28px" })}>
            <div className={css({ position: "absolute", top: 0, height: "2px", left: "16.66%", right: "16.66%" })} style={{ background: `linear-gradient(90deg, ${CRIMSON}, ${GOLD}, ${CRIMSON})` }} />
            {JUNIORS.map((m) => (
              <div key={m.name} className={css({ position: "relative", display: "flex", justifyContent: "center" })}>
                <div className={css({ position: "absolute", top: "-28px", left: "50%", width: "2px", height: "28px", transform: "translateX(-50%)" })} style={{ background: STEM }} />
                <Node member={m} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The credit line beneath the sign-in card. Click "Digital Department" to
 *  open the team card. The copyright line is the page's own footer (see
 *  login/page.tsx) — pinned to the bottom of the viewport, not part of this. */
export default function DigitalDepartmentCredit() {
  const [open, setOpen] = useState(false);

  return (
    <div className={css({ textAlign: "center", fontSize: "12.5px" })} style={{ color: ac.muted }}>
      Developed by{" "}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={css({ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", fontWeight: 700 })}
        style={{ color: ac.accentText }}
      >
        Digital Department
      </button>
      {open ? <CreditModal onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
