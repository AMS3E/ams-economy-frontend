import Link from "next/link";
import { css, cx } from "@/styled-system/css";
import { footerCols, footerLegal, newsletter, type FooterLink } from "@/lib/home-data";
import { SOCIALS } from "@/lib/site";
import { container } from "./shared";
import SocialIcon from "@/components/ui/SocialIcon";

const linkStyle = css({
  color: "#9a9ba3",
  fontSize: "15px",
  textDecoration: "none",
  transition: "color .2s",
  _hover: { color: "#fff" },
});

const legalStyle = css({
  color: "#9a9ba3",
  fontSize: "13px",
  textDecoration: "none",
  transition: "color .2s",
  _hover: { color: "#fff" },
});

/** An internal link goes through <Link> for client-side navigation; an AMS
 *  sister site is a plain anchor, since it leaves the app entirely. */
function FooterAnchor({ link, className }: { link: FooterLink; className: string }) {
  return link.external ? (
    <a href={link.href} className={className} target="_blank" rel="noopener noreferrer">
      {link.label}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

/** Shared site footer (used on every page via the layout). */
export default function SiteFooter() {
  return (
    <footer
      className={css({
        background: "#0a0d14",
        width: "100%",
        padding: "40px 0 0px",
        borderTop: "1px solid rgba(255,255,255,.05)",
      })}
    >
      <div className={container}>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "18px",
            paddingBottom: "28px",
            borderBottom: "1px solid rgba(255,255,255,.07)",
          })}
        >
          {/* Footer logo (white SVG, sits on the dark footer background). Served
              from public/ — see public/assets/Logo-Footer.svg. Intrinsic size is
              142×46; width/height attrs reserve space to avoid layout shift. */}
          <img src="/assets/Logo-Footer.svg" alt="Apsara Media Services" width={181} height={58} className={css({ height: "60px", width: "auto", display: "block" })} />
          <div className={css({ display: "flex", flexWrap: "wrap", gap: "22px" })}>
            {/* These were <span cursor:pointer> — they looked clickable and were
                not. They are the real AMS accounts now. */}
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#9a9ba3",
                  fontSize: "16px",
                  textDecoration: "none",
                  transition: "color .2s",
                  _hover: { color: "#fff" },
                })}
              >
                {/* White brand glyph (no badge), sized via font-size. */}
                <span className={css({ display: "inline-flex", color: "#fff", fontSize: "16px" })}>
                  <SocialIcon name={s.name} />
                </span>
                {s.name}
              </a>
            ))}
          </div>
        </div>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: { base: "repeat(2,1fr)", md: "repeat(4,1fr)" },
            gap: "28px",
            padding: "30px 0",
          })}
        >
          {footerCols.map((col) => {
            // Split links into two column-major halves: first half fills the
            // left sub-column, the rest fills the right (matches the design).
            const half = Math.ceil(col.links.length / 2);
            const groups = [col.links.slice(0, half), col.links.slice(half)];
            return (
              <div key={col.heading}>
                <div className={css({ color: "#fff", fontSize: "18px", fontWeight: 600, marginBottom: "25px" })}>{col.heading}</div>
                <div
                  className={css({
                    display: "grid",
                    gridTemplateColumns: { base: "1fr", sm: "1fr 1fr" },
                    columnGap: "20px",
                    rowGap: "10px",
                  })}
                >
                  {groups.map((group, gi) => (
                    <div key={gi} className={css({ display: "flex", flexDirection: "column", gap: "18px" })}>
                      {group.map((l) => (
                        <FooterAnchor key={l.label} link={l} className={linkStyle} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Newsletter CTA column */}
          <div>
            <div className={css({ color: "#fff", fontSize: "18px", fontWeight: 700, marginBottom: "25px", lineHeight: 1.5 })}>{newsletter.heading}</div>
            <div className={css({ color: "#9a9ba3", fontSize: "15px", fontWeight: 500, marginBottom: "25px", lineHeight: 1.5 })}>
              សូមចុចប៊ូតុងខាងក្រោមដើម្បីទទួលបានព័ត៌មានថ្មីបំផុត!
            </div>
            {/* A button, not an <a href="#">: there is nothing to sign up to yet
                (see `newsletter` in home-data.ts), and a link that goes nowhere
                is the exact decoy this pass is removing everywhere else. */}
            <button
              type="button"
              className={css({
                display: "inline-block",
                background: "#2d3240",
                color: "#fff",
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: 1.4,
                padding: "11px 16px",
                borderRadius: "3px",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                transition: "opacity .2s",
                _hover: { opacity: 0.9, background: "linear-gradient(90deg, rgba(252,125,69,1) 0%, rgba(253,29,29,1) 30%, rgba(139,58,180,1) 100%)" },
              })}
            >
              {newsletter.buttonLabel}
            </button>
          </div>
        </div>
      </div>
      {/* Full-bleed black bar: the background sits on the outer element so it
          spans the viewport, and `container` constrains the content inside it. */}
      <div className={css({ background: "black" })}>
        <div
          className={cx(
            container,
            css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              padding: "15px 0px",
            }),
          )}
        >
          <div className={css({ color: "#6b6c75", fontSize: "13px" })}>
            ឆ្នាំ2020 - 2024 © រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ៖ អគ្គនាយកដ្ឋានវិទ្យុ និងទូរទស្សន៍អប្សរា | អភិវឌ្ឍដោយ Apsara Media Services
          </div>
          <div className={css({ display: "flex", gap: "20px", flexWrap: "wrap" })}>
            {footerLegal.map((l) => (
              <FooterAnchor key={l.label} link={l} className={legalStyle} />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
