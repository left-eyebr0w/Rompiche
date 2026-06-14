/* ── PRNG déterministe (mulberry32) ───────────────────────────────────────────
   Source unique de tout aléatoire audible. Un seul ordre de consommation par
   session : Poisson → pickImpact → sample → detune (documenté dans PHASE-0.md).
   Math.random() est INTERDIT dans le chemin audio — seul ce PRNG y a accès. */

export function makePrng(seed) {
  let state = seed >>> 0
  function aléa() {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  function fork() {
    return makePrng(Math.floor(aléa() * 0xFFFFFFFF) + 1)
  }
  return { aléa, fork, seed }
}
