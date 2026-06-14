/* ── Registre central des matériaux ──────────────────────────────────────────
   Source unique de vérité pour « ce qui sonne ». Chaque matériau porte sa banque
   de samples et ses paramètres acoustiques (§6/§13 de SYSTEME-SURFACES.md).
   Ajouter un matériau = une entrée ici, zéro code de placement.

   Les distances (minDistance/maxDistance) sont exprimées en MÈTRES ; la couche
   acoustique les multiplie par METER (cf. coords.ts) au moment de créer les
   sources. En Phase 0/1 elles ne sont pas encore consommées (atténuation
   réactivée en Phase 3), mais on les déclare dès maintenant pour figer le contrat. */

export type MaterialId = 'metal' | 'bache' | 'terre'

export interface Material {
  id: MaterialId
  label: string
  urls: string[]
  gain: number
  minDistance: number
  maxDistance: number
  debugColor: number
}

/* Banques de samples de la famille « impacts » (impacts de pluie par matériau de
   surface), rangées dans src/assets/audio/impacts/<id>/. Les globs Vite sont
   résolus relativement à CE fichier. Déposer un .wav dans le bon dossier suffit à
   l'inclure — aucun manifeste à tenir à jour. Voir src/assets/audio/README.md pour
   la convention d'arborescence (organisation par famille sonore). */
const sampleUrls: Record<MaterialId, string[]> = {
  metal: Object.values(
    import.meta.glob('../../assets/audio/impacts/metal/*.wav', { query: '?url', import: 'default', eager: true }),
  ),
  bache: Object.values(
    import.meta.glob('../../assets/audio/impacts/bache/*.wav', { query: '?url', import: 'default', eager: true }),
  ),
  terre: Object.values(
    import.meta.glob('../../assets/audio/impacts/terre/*.wav', { query: '?url', import: 'default', eager: true }),
  ),
}

/* maxDistance : au-delà, Resonance coupe NET à zéro (gain = 0, cf.
   attenuation.js). DOIT couvrir le rayon de la couche héros L1 : une voix est
   routée en héros tant que dist < r1 − overlap (≈ 9,6 m sur le préset diorama,
   r1 = 12 m). Avec METER = 1 (1 u = 1 m), une valeur en dessous de r1 rendait
   muettes 20-25 % des voix héros pourtant affichées par le HUD (qui lit le grain
   AVANT spatialisation) — tête excentrée → tout un côté du monde silencieux.
   14 m couvre r1 avec marge. À recalibrer si L1rMax change.

   debugColor : couleur de DIAGNOSTIC (overlay debug des voix). En vue normale,
   le wireframe est monochrome — le matériau ne pilote AUCUNE couleur de scène.
   Cette teinte ne vit que dans VoiceOverlay (Ctrl+Alt+D). Source unique : ici. */
export const MATERIALS: Material[] = [
  { id: 'metal', label: 'Métal', urls: sampleUrls.metal, gain: 1, minDistance: 0.5, maxDistance: 14, debugColor: 0xe8c96d },
  { id: 'bache', label: 'Bâche', urls: sampleUrls.bache, gain: 1, minDistance: 0.5, maxDistance: 14, debugColor: 0x7ec8e3 },
  { id: 'terre', label: 'Terre', urls: sampleUrls.terre, gain: 1, minDistance: 0.5, maxDistance: 14, debugColor: 0x9ae87a },
]

/* id → indice dans MATERIALS (pour les Uint8Array du terrain) */
export const MATERIAL_INDEX: Record<MaterialId, number> = Object.fromEntries(
  MATERIALS.map((m, i) => [m.id, i]),
) as Record<MaterialId, number>

export function materialById(id: string): Material | null {
  return MATERIALS[(MATERIAL_INDEX as Record<string, number>)[id]] ?? null
}

/* Invariant « matériau obligatoire » : toute surface (cellule de terrain, objet)
   DOIT porter un matériau connu. On lève ici plutôt que de retomber silencieusement
   sur un défaut — un id manquant ou inconnu est un bug de placement, pas un cas
   nominal. Point unique d'application du contrat. */
export function requireMaterial(id: string): Material {
  const m = materialById(id)
  if (!m) {
    throw new Error(`[materials] matériau requis mais introuvable : "${id}". ` +
      `Connus : ${MATERIALS.map(x => x.id).join(', ')}.`)
  }
  return m
}
