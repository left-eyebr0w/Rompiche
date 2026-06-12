/* ── Repère & échelle — source unique de vérité (§4 de SYSTEME-SURFACES.md) ──
   Avant, les formules `HC = size·0,26` et `limit = half − HC/2 − 10` étaient
   recopiées dans RainSampler, WireframeCube et DebugHUD. On les centralise ici
   pour garantir UN SEUL repère monde (celui de Three.js).

   Échelle métrique : le cube de la tête vaut 1 m (HC unités-monde).
     METER = HC          → 1 m
     BLOCK = METER       → 1 m  (relief / objets)
     CELL  = METER / 2   → 0,5 m (matériau de surface + résolution audio) */
export function makeCoords(size) {
  const half = size / 2
  const HC = Math.round(size * 0.26)
  const METER = HC
  return {
    size,
    half,
    HC,
    limit: half - HC / 2 - 10, // course de l'auditeur sur chaque axe
    ground: -half,             // plan du sol en monde
    METER,
    BLOCK: METER,
    CELL: METER / 2,
  }
}

/* Axe Z de l'INPUT auditeur (sliders, normalisés [−1,1]) → monde Three.js.
   L'axe Z de la tête est inversé par rapport au Z monde ; cette inversion vit
   ICI et nulle part ailleurs, pour que le visuel et l'audio partagent le même
   point de chute. */
export function headInputToWorld({ x, y, z }, limit) {
  return { x: x * limit, y: y * limit, z: -z * limit }
}

/* Monde Three.js → Resonance Audio. Conversion identité aujourd'hui : c'est le
   SEUL endroit où la traduction vers le moteur acoustique a le droit de vivre
   (le « piège du Z », §4). Si un jour les repères divergent, on ne touche qu'ici. */
export function worldToResonance({ x, y, z }) {
  return [x, y, z]
}

/* Azimut caméra (spin, degrés) → vecteur AVANT monde de l'auditeur.
   L'auditeur écoute depuis la tête mais s'oriente comme la caméra : le
   gauche/droite audio suit la vue orbitée (correction 1 du diagnostic).
   Dérivé de la position caméra de WireframeCube — dist·(sin spin, ·, cos spin)
   regardant l'origine — donc avant horizontal = (−sin, 0, −cos). Le tilt
   vertical est ignoré : l'auditeur reste droit (up = +Y), pour ne pas basculer
   tout le champ sonore avec la plongée de la caméra. */
export function spinToForward(spinDeg) {
  const a = (spinDeg * Math.PI) / 180
  return { x: -Math.sin(a), y: 0, z: -Math.cos(a) }
}
