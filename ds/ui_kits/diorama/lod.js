/* ── LOD & crossfade à puissance constante (§8, §16.4) ───────────────────────
   Utilitaires partagés entre LodController et RainSampler. */

/** Crossfade à puissance constante entre deux couches.
 *  t ∈ [0,1] : 0 = pleinement dans la couche basse (proche), 1 = couche haute.
 *  g_bas² + g_haut² = 1 → énergie conservée. */
export function fondu(t) {
  const tc = Math.max(0, Math.min(1, t))
  return [Math.cos(tc * Math.PI / 2), Math.sin(tc * Math.PI / 2)]
}

/** Résout les paramètres LOD depuis les frontières de bandes (§16.4). */
export function resolveLodParams(bands, cfg) {
  const { r1, r2, overlap } = bands
  const h = Math.max(0.3, 0.5 * overlap) // hystérésis
  return {
    r1, r2, overlap, h,
    debounce: 150,  // ms — anti-rebond
    r1Min:    1.0,  // borne basse pour l'ajustement de budget
    r1Max:    cfg.layers.L1.rMax,
    busyHi:   0.95,
    busyLo:   0.50,
    pas:      0.5,  // m — pas d'ajustement r1
  }
}
