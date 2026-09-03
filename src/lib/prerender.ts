// Gates build-time static generation for the public site's param'd routes.
// Off by default: each of the seven routes below fetches live WordPress data
// per slug/path at build time, and a single slow or unreachable fetch takes
// the whole `next build` down with it (measured, docs/session-log.md Session
// 39 — 267 pages -> 32 once this is off, static generation 4.4s vs. workers
// starving/timing out). Runtime behaviour is unchanged either way: every
// route stays ISR with `dynamicParams` on, so a page renders on first
// request and caches normally. Set PRERENDER_PUBLIC=1 (as a BUILD-TIME
// argument, not a runtime env var — see docs/project-context.md §6) once the
// backend is fast/reliable enough to afford prebuilding these again.
export const PRERENDER_PUBLIC = process.env.PRERENDER_PUBLIC === "1";
