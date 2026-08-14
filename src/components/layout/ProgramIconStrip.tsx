import Link from "next/link";
import { css } from "@/styled-system/css";
import type { ProgramIcon } from "@/lib/navigation";

// A Server Component: every item is a published WordPress Program and links to
// its internal /program/<slug> page. There is no client-side state in the row.

// `.site_header__secondary-nav-v3 .nav > li > a` at desktop width (≥1440px
// in the live CSS's own breakpoints) — the row's real height comes from this
// padding + the 26px icon, not a fixed box on the row itself (see SiteHeader).
const icon = css({
  padding: "11px 15px",
  lineHeight: "18px",
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
});

const logo = css({ height: "26px", width: "auto", objectFit: "contain", display: "block" });

export default function ProgramIconStrip({ icons }: { icons: ProgramIcon[] }) {
  return (
    <>
      {icons.map(c => (
        <Link key={c.slug} href={c.href} title={c.title} className={icon}>
          {/* Brand logos of varying width, uniform height — plain <img> (many are SVG). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.image} alt={c.title} className={logo} />
        </Link>
      ))}
    </>
  );
}
