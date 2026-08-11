"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { css } from "@/styled-system/css";
import type { ProgramIcon } from "@/lib/navigation";
import { programHref } from "@/lib/programs";

// The one part of the header that needs client JS. Highlighting the program you
// are currently on means knowing the current route, and in the App Router that is
// only readable from a hook — a Server Component cannot see the pathname. Keeping
// it to this strip leaves the rest of SiteHeader server-rendered.

const icon = css({
  height: "38px",
  padding: "11px",
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
  // Muted by default. The active program — and whatever the pointer is on — is
  // the only thing in full colour, so the strip reads as "you are here".
  filter: "grayscale(1)",
  opacity: 0.55,
  transition: "filter .25s, opacity .25s",
  _hover: { filter: "grayscale(0)", opacity: 1 },
  // Driven by a data attribute rather than a conditional class: Panda compiles
  // atomic classes at build time, so two competing `filter` classes would be
  // resolved by stylesheet order, not by which one we meant to win.
  "&[data-active='true']": { filter: "grayscale(0)", opacity: 1 },
});

const logo = css({ height: "38px", width: "auto", objectFit: "contain", display: "block" });

export default function ProgramIconStrip({ icons }: { icons: ProgramIcon[] }) {
  const pathname = usePathname();

  return (
    <>
      {icons.map(c => {
        const href = programHref(c.slug);
        // Active on the program's overview page AND on its episode pages, which
        // nest beneath it (/program/<slug>/<episode>).
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={c.slug}
            href={href}
            title={c.title}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className={icon}>
            {/* Brand logos of varying width, uniform height — plain <img> (many are SVG). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt={c.title} className={logo} />
          </Link>
        );
      })}
    </>
  );
}
