/* ── Repère & échelle — source unique de vérité (§4 de SYSTEME-SURFACES.md) ──
   Avant, les formules `HC = size·0,26` et `limit = half − HC/2 − 10` étaient
   recopiées dans RainSampler, WireframeCube et DebugHUD. On les centralise ici
   pour garantir UN SEUL repère monde (celui de Three.js).

   Échelle métrique : le cube de la tête vaut 1 m (HC unités-monde).
     METER = HC          → 1 m
     BLOCK = METER       → 1 m  (relief / objets)
     CELL  = METER / 2   → 0,5 m (matériau de surface + résolution audio) */

export interface Coords {
  size: number
  half: number
  HC: number
  limit: number
  ground: number
  METER: number
  BLOCK: number
  CELL: number
  worldRadius: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface HeadInput {
  x: number
  y: number
  z: number
}

export interface HeadFace {
  label: 'FRONT' | 'BACK' | 'DROIT' | 'GAUCH' | 'HAUT' | 'BAS'
  n: [number, number, number]
}

export function makeCoords(size: number): Coords {
  const half = size / 2
  const HC = Math.round(size * 0.26)
  const METER = HC
  return {
    size,
    half,
    HC,
    // course de l'auditeur sur chaque axe. Marge métrique (10 % du demi-côté),
    // PAS une constante pixel : `size` est en mètres depuis la migration WorldConfig.
    // Source UNIQUE partagée par l'audio (headInputToWorld) ET le visuel (WireframeCube) → I5.
    limit: Math.max(0.1, half - HC / 2 - half * 0.1),
    ground: -half,             // plan du sol en monde
    METER,
    BLOCK: METER,
    CELL: METER / 2,
    worldRadius: half,         // rayon du monde en unités-monde (I5 — résoudreCouches)
  }
}

/* Axe Z de l'INPUT auditeur (sliders, normalisés [−1,1]) → monde Three.js.
   L'axe Z de la tête est inversé par rapport au Z monde ; cette inversion vit
   ICI et nulle part ailleurs, pour que le visuel et l'audio partagent le même
   point de chute. */
export function headInputToWorld({ x, y, z }: HeadInput, limit: number): Vector3 {
  return { x: x * limit, y: y * limit, z: -z * limit }
}

/* Monde Three.js → Resonance Audio. Conversion identité aujourd'hui : c'est le
   SEUL endroit où la traduction vers le moteur acoustique a le droit de vivre
   (le « piège du Z », §4). Si un jour les repères divergent, on ne touche qu'ici. */
export function worldToResonance({ x, y, z }: Vector3): [number, number, number] {
  return [x, y, z]
}

/* Orientation FIXE de l'auditeur (avant monde, normalisé). La tête est l'input
   de référence et ne tourne PAS avec l'orbite caméra (spin) : orbiter la vue
   change le point de vue, pas l'écoute. Le champ sonore reste donc stable —
   gauche/droite/devant sont ancrés au monde, pas à l'écran.
   Avant = −Z monde (convention Resonance par défaut), haut = +Y. */
export const LISTENER_FORWARD: Vector3 = { x: 0, y: 0, z: -1 }

/* Les 6 faces de la tête = les 6 points d'écoute directionnels (normales monde).
   Source UNIQUE partagée par le rendu (RainSampler projette les voix dessus pour
   le traçage) et le DebugHUD (barres live). Chaque face est une « piste » : la
   même session se relit comme 6 timelines, une par direction d'écoute. */
export const HEAD_FACES: HeadFace[] = [
  { label: 'FRONT', n: [0,  0, -1] }, // avant  (−Z monde)
  { label: 'BACK',  n: [0,  0,  1] }, // arrière (+Z monde)
  { label: 'DROIT', n: [1,  0,  0] }, // droite (+X monde)
  { label: 'GAUCH', n: [-1, 0,  0] }, // gauche (−X monde)
  { label: 'HAUT',  n: [0,  1,  0] }, // haut   (+Y monde)
  { label: 'BAS',   n: [0, -1,  0] }, // bas    (−Y monde)
]
