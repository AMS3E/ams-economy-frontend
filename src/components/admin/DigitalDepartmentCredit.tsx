"use client";

import { useEffect, useRef, useState } from "react";
import { css, cx } from "@/styled-system/css";
import { ac } from "./tokens";
import { Icon } from "./icons";

// The sign-in page's credit line — "Developed by Digital Department" — and
// the org chart it opens. (The copyright line is the page's own footer, pinned
// to the bottom of the viewport in login/page.tsx; it is not part of this.)
// Mirrors the sister Infotainment admin's DepartmentCredit.tsx exactly — there
// is no shared package between the Next.js frontends, so this is kept in sync
// by hand.
//
// The chart is a deliberate exception to the admin palette. Every working
// screen in the tool is quiet, neutral and theme-following; this is a credits
// roll, and it is meant to feel like one — fixed near-black in BOTH themes,
// with the AMS mark's own violet → crimson → gold run doing the colour. That
// is the one place in the tool where brand chrome is the point rather than a
// distraction, so the "no brand colours as ink" rule is set aside for the
// rings, rules and captions here. Body text stays white and passes AA on the
// fixed ground (white 17.4:1, the 62% sub 9.3:1, the gold captions 8.1:1).
//
// Roster is the 2025 Digital Department project chart ("Credit Team (3)",
// 2026-09-08): the project lead, the project coordinator under him, and the
// two dashboard developers side by side under her. Four people, three tiers.

/* ---------------------------------------------------------------------------
 * Roster
 * ------------------------------------------------------------------------- */

type Person = {
  honorific: "Mr." | "Ms.";
  /** Family name in capitals, as the department chart writes it. */
  name: string;
  role: string;
  /** The chart's parenthetical under the role — the project role for the two
   *  leads, the dashboard credit for the two developers. Verbatim from the
   *  chart, parentheses included: the owner asked for the exact letters and
   *  words. */
  detail: string;
  photo: string;
};

const HEAD: Person = {
  honorific: "Mr.",
  name: "SAY Prumny",
  role: "Deputy Head of Digital",
  detail: "(Project Lead)",
  photo: "/team/say-prumny.webp",
};
const COORDINATOR: Person = {
  honorific: "Ms.",
  name: "SAY Thalyna",
  role: "Digital Marketing Supervisor",
  detail: "(Project Coordinator)",
  photo: "/team/say-thalyna.webp",
};
const DEVELOPERS: Person[] = [
  {
    honorific: "Mr.",
    name: "CHHIN Pov",
    role: "Lead Web Developer",
    detail: "(Economy + Education Admin Dashboard Developer)",
    photo: "/team/chhin-pov.webp",
  },
  {
    honorific: "Mr.",
    name: "SOTH Kimleng",
    role: "Full-stack Developer",
    detail: "(Infotainment Admin Dashboard Developer)",
    photo: "/team/soth-kimleng.webp",
  },
];

/* ---------------------------------------------------------------------------
 * The fixed palette — see the header comment for why this ignores `ac.*`.
 * ------------------------------------------------------------------------- */

const INK = "#F5F5F7";
const INK_SUB = "rgba(245,245,247,0.62)";
const INK_FAINT = "rgba(245,245,247,0.40)";
const GROUND = "#0B0B0E";
const VIOLET = "#59174D";
const CRIMSON = "#C0233F";
const GOLD = "#DE9838";

/** The ring around every portrait: the mark's gradient wrapped into a circle. */
const RING = `conic-gradient(from 210deg, ${VIOLET}, ${CRIMSON} 30%, ${GOLD} 55%, ${CRIMSON} 80%, ${VIOLET})`;
const LINE_V = `linear-gradient(180deg, ${GOLD}, ${CRIMSON})`;
const LINE_H = `linear-gradient(90deg, ${CRIMSON}, ${GOLD} 50%, ${CRIMSON})`;
const LINE_GLOW = "0 0 14px rgba(222,152,56,0.35)";

/* ---------------------------------------------------------------------------
 * Styles
 * ------------------------------------------------------------------------- */

const ease = "cubic-bezier(0.2, 0.7, 0.2, 1)";

const overlay = css({
  position: "fixed",
  inset: 0,
  zIndex: 1000050,
  display: "flex",
  overflowY: "auto",
  padding: { base: "16px", sm: "32px" },
  background: "rgba(4,4,6,0.78)",
  backdropFilter: "blur(8px)",
  animation: `adminFadeIn 240ms ease both`,
  _motionReduce: { animation: "none" },
});

const panel = css({
  // `margin: auto` centres the panel when it is shorter than the viewport and
  // lets the overlay scroll it when it is taller — a flex `alignItems: center`
  // would clip the top of a tall panel instead.
  margin: "auto",
  position: "relative",
  width: "min(680px, 100%)",
  borderRadius: "24px",
  padding: { base: "28px 20px 32px", sm: "40px 44px 44px" },
  overflow: "hidden",
  animation: `adminZoomIn 380ms ${ease} both`,
  _motionReduce: { animation: "none" },
});

const closeBtn = css({
  position: "absolute",
  top: "16px",
  right: "16px",
  width: "36px",
  height: "36px",
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "background .13s ease, border-color .13s ease",
  _hover: { background: "rgba(255,255,255,0.10)" },
  _focusVisible: {
    outline: "2px solid rgba(255,255,255,0.85)",
    outlineOffset: "2px",
  },
});

const eyebrow = css({
  fontSize: "10.5px",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
});

const title = css({
  fontSize: { base: "26px", sm: "34px" },
  fontWeight: 800,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  marginTop: "10px",
});

const rule = css({
  height: "1px",
  marginTop: "26px",
  marginBottom: "30px",
});

/** One tier of the chart: the portrait stacked over its caption, centred. */
const tier = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  animation: `adminRise 560ms ${ease} both`,
  _motionReduce: { animation: "none" },
});

/** The connectors (spine, fan bar, stubs) fade in in place rather than
 *  rising like the portraits: `tier`'s translateY means an adjacent line and
 *  the node it leads to start from different offsets, so on a staggered
 *  delay they can render visibly detached mid-animation. A plain fade never
 *  has a frame where the connector looks unplugged from its portrait. */
const connector = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  animation: `adminFadeIn 260ms ease both`,
  _motionReduce: { animation: "none" },
});

const ring = css({
  display: "block",
  borderRadius: "50%",
  padding: "4px",
  flex: "none",
});

const photo = css({
  display: "block",
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  // A dark gap between ring and portrait, so the gradient reads as a ring
  // rather than a bleed off the white background of the cut-out.
  border: "3px solid var(--dept-ground)",
});

/** Portrait sizes step down through the tiers so the eye reads the chain of
 *  command top-down without a single label. The two developers are peers and
 *  share a size. */
const SIZE = {
  head: css({
    width: { base: "124px", sm: "156px" },
    height: { base: "124px", sm: "156px" },
  }),
  coordinator: css({
    width: { base: "104px", sm: "122px" },
    height: { base: "104px", sm: "122px" },
  }),
  developer: css({
    width: { base: "92px", sm: "108px" },
    height: { base: "92px", sm: "108px" },
  }),
} as const;

const GLOW = {
  head: "0 0 0 1px rgba(255,255,255,0.06), 0 0 56px rgba(192,35,63,0.55), 0 18px 40px rgba(0,0,0,0.6)",
  coordinator:
    "0 0 0 1px rgba(255,255,255,0.06), 0 0 40px rgba(192,35,63,0.42), 0 14px 32px rgba(0,0,0,0.55)",
  developer:
    "0 0 0 1px rgba(255,255,255,0.06), 0 0 32px rgba(192,35,63,0.36), 0 12px 28px rgba(0,0,0,0.5)",
} as const;

const caption = css({
  marginTop: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3px",
});

const honorificCls = css({
  fontSize: "10.5px",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
});

const NAME = {
  head: css({
    fontSize: { base: "17px", sm: "19px" },
    fontWeight: 800,
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
  }),
  coordinator: css({
    fontSize: { base: "15px", sm: "16.5px" },
    fontWeight: 800,
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
  }),
  developer: css({
    fontSize: { base: "14.5px", sm: "15.5px" },
    fontWeight: 800,
    letterSpacing: "-0.01em",
    lineHeight: 1.2,
  }),
} as const;

const roleCls = css({
  fontSize: { base: "9.5px", sm: "10.5px" },
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  lineHeight: 1.4,
  marginTop: "2px",
});

/** The parenthetical under a role — quieter than the gold title, but sized
 *  to be read, not squinted at (the owner asked for it larger and tighter). */
const detailCls = css({
  fontSize: { base: "12.5px", sm: "13.5px" },
  fontWeight: 500,
  lineHeight: 1.45,
  marginTop: "2px",
  // Wide enough for "(Economy + Education Admin Dashboard Developer)" on one
  // line at the desktop size; inside a developer column it wraps to two.
  maxWidth: "52ch",
});

/** The spine between tiers: a luminous 2px rule. The chart has no group
 *  boxes, so there are no captions on it — each person connects straight to
 *  the next. */
const spine = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});
const spineLine = css({ width: "2px", height: "26px" });

/** The fan-out under the coordinator: one bar across the two columns'
 *  centres (a quarter in from each edge), then a stub down into each
 *  portrait. */
const fan = css({ position: "relative", width: "100%", marginTop: 0 });
const fanBar = css({
  position: "absolute",
  top: 0,
  left: "calc(100% / 4)",
  right: "calc(100% / 4)",
  height: "2px",
});
const teamGrid = css({
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  columnGap: { base: "12px", sm: "24px" },
});
const teamCol = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});
const stub = css({ width: "2px", height: "26px" });

/* ---------------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------------- */

function Portrait({
  person,
  tier: t,
  delay,
}: {
  person: Person;
  tier: keyof typeof SIZE;
  delay: number;
}) {
  return (
    <figure
      className={tier}
      style={{ animationDelay: `${delay}ms`, margin: 0 }}
    >
      <span
        className={cx(ring, SIZE[t])}
        style={{ background: RING, boxShadow: GLOW[t] }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- four static 512px cut-outs under /public/team; nothing for next/image to optimise */}
        <img
          src={person.photo}
          alt={`${person.honorific} ${person.name}`}
          width={512}
          height={512}
          decoding="async"
          className={photo}
        />
      </span>
      <figcaption className={caption}>
        <span className={honorificCls} style={{ color: INK_FAINT }}>
          {person.honorific}
        </span>
        <span className={NAME[t]} style={{ color: INK }}>
          {person.name}
        </span>
        <span className={roleCls} style={{ color: GOLD }}>
          {person.role}
        </span>
        <span className={detailCls} style={{ color: INK_SUB }}>
          {person.detail}
        </span>
      </figcaption>
    </figure>
  );
}

function Spine({ delay }: { delay: number }) {
  return (
    <div className={cx(spine, connector)} style={{ animationDelay: `${delay}ms` }}>
      <span
        className={spineLine}
        style={{ background: LINE_V, boxShadow: LINE_GLOW }}
      />
    </div>
  );
}

// Exported so the public site footer's own "Digital Department" credit can
// open the same team card (see SiteFooter.tsx) instead of duplicating it.
export function CreditModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes; focus lands on the close button so a keyboard user is
  // inside the dialog the moment it opens; the page behind stops scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className={overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dept-title"
        onClick={(e) => e.stopPropagation()}
        className={panel}
        style={{
          ["--dept-ground" as string]: GROUND,
          color: INK,
          background: `radial-gradient(70% 42% at 50% -6%, rgba(192,35,63,0.42), transparent 70%), radial-gradient(46% 30% at 50% 104%, rgba(89,23,77,0.42), transparent 70%), ${GROUND}`,
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={closeBtn}
          style={{
            color: INK,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <Icon name="x" size={16} strokeWidth={2} />
        </button>

        <div className={eyebrow} style={{ color: GOLD }}>
          Apsara Media Services
        </div>
        <h2 id="dept-title" className={title} style={{ color: INK }}>
          Digital Department
        </h2>
        <div
          className={rule}
          style={{
            background: `linear-gradient(90deg, transparent, ${CRIMSON} 30%, ${GOLD} 50%, ${CRIMSON} 70%, transparent)`,
          }}
        />

        <Portrait person={HEAD} tier="head" delay={60} />
        <Spine delay={180} />
        <Portrait person={COORDINATOR} tier="coordinator" delay={260} />
        <Spine delay={360} />

        <div className={fan}>
          <div
            className={cx(fanBar, connector)}
            style={{
              background: LINE_H,
              boxShadow: LINE_GLOW,
              animationDelay: "400ms",
            }}
          />
          <div className={teamGrid}>
            {DEVELOPERS.map((p, i) => (
              <div key={p.name} className={teamCol}>
                <span
                  className={cx(stub, connector)}
                  style={{
                    background: LINE_V,
                    boxShadow: LINE_GLOW,
                    animationDelay: `${440 + i * 70}ms`,
                  }}
                />
                <Portrait person={p} tier="developer" delay={480 + i * 70} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * The credit line
 * ------------------------------------------------------------------------- */

const credit = css({
  fontSize: "12px",
  lineHeight: 1.6,
  textAlign: "center",
  margin: 0,
});

const linkBtn = css({
  background: "none",
  border: 0,
  padding: 0,
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  borderRadius: "3px",
  textDecoration: "underline",
  textDecorationThickness: "1px",
  textUnderlineOffset: "3px",
  textDecorationColor: "transparent",
  transition: "text-decoration-color .13s ease",
  _hover: { textDecorationColor: "currentColor" },
  _focusVisible: {
    outline: "2px solid var(--colors-admin-focus)",
    outlineOffset: "2px",
    textDecorationColor: "currentColor",
  },
});

/** The credit line beneath the sign-in card. Click "Digital Department" to
 *  open the team card. The copyright line is the page's own footer (see
 *  login/page.tsx) — pinned to the bottom of the viewport, not part of this. */
export default function DigitalDepartmentCredit() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    // Hand focus back to the link that opened it — closing a dialog should
    // never drop a keyboard user at the top of the page.
    triggerRef.current?.focus();
  };

  return (
    <>
      <p className={credit} style={{ color: ac.muted }}>
        Developed by{" "}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={linkBtn}
          style={{ color: ac.accentText }}
        >
          Digital Department
        </button>
      </p>
      {open ? <CreditModal onClose={close} /> : null}
    </>
  );
}
