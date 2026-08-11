import { css, cx } from "@/styled-system/css";
import { container } from "@/components/layout/shared";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

// Same band as ProgramHero, so the gradient is already in place while the title loads.
const hero = css({
  position: "relative",
  minHeight: { base: "220px", md: "320px" },
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundImage:
    "radial-gradient(120% 140% at 50% 0%, token(colors.programHero.from) 0%, token(colors.programHero.mid) 45%, token(colors.programHero.to) 100%)",
});

const about = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "280px 1fr" },
  gap: { base: "24px", md: "44px" },
  alignItems: "start",
  paddingTop: "40px",
});

const posterCard = css({ width: "100%", maxWidth: { base: "220px", md: "none" }, mx: { base: "auto", md: "0" } });
const carousel = css({ display: "flex", gap: "16px", overflow: "hidden", paddingTop: "22px" });
const card = css({ flex: "0 0 224px" });

/** Program pages all prebuild, so this rarely shows — but it covers the window
 *  after a cache expiry, and it gives Next a shell to prefetch. */
export default function ProgramLoading() {
  return (
    <>
      <div className={hero}>
        <Skeleton height='44px' width='min(420px, 70vw)' radius='4px' />
      </div>

      <div className={cx(container, css({ paddingBottom: "60px" }))}>
        <div className={about}>
          <div className={posterCard}>
            <Skeleton aspectRatio='2/3' radius='6px' />
          </div>
          <div className={css({ display: "flex", flexDirection: "column", gap: "16px" })}>
            <Skeleton height='30px' width='55%' radius='4px' />
            <SkeletonText lines={4} />
            <SkeletonText lines={3} />
          </div>
        </div>

        {/* episode carousel */}
        <div className={css({ paddingTop: "44px" })}>
          <Skeleton height='22px' width='180px' radius='3px' />
          <div className={carousel}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className={card}>
                <Skeleton aspectRatio='2/3' />
                <div className={css({ marginTop: "10px" })}>
                  <SkeletonText lines={2} height='11px' gap='7px' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
