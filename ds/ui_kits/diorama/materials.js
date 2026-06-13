/* ── Registre central des matériaux ──────────────────────────────────────────
   Source unique de vérité pour « ce qui sonne ». Chaque matériau porte sa banque
   de samples et ses paramètres acoustiques (§6/§13 de SYSTEME-SURFACES.md).
   Ajouter un matériau = une entrée ici, zéro code de placement.

   Les distances (minDistance/maxDistance) sont exprimées en MÈTRES ; la couche
   acoustique les multiplie par METER (cf. coords.js) au moment de créer les
   sources. En Phase 0/1 elles ne sont pas encore consommées (atténuation
   réactivée en Phase 3), mais on les déclare dès maintenant pour figer le contrat. */

const sampleUrls = {
  metal: Object.values(
    import.meta.glob('./samples/metal/*.wav', { query: '?url', import: 'default', eager: true }),
  ),
  bache: Object.values(
    import.meta.glob('./samples/bache/*.wav', { query: '?url', import: 'default', eager: true }),
  ),
  terre: Object.values(
    import.meta.glob('./samples/terre/*.wav', { query: '?url', import: 'default', eager: true }),
  ),
}

/* maxDistance : au-delà, Resonance coupe NET à zéro (gain = 0, cf.
   attenuation.js). Le monde fait ~3,8 m de côté soit ~5,4 m en diagonale :
   avec l'ancien 4 m, une tête excentrée rendait toute une bande de pluie
   muette (trous rythmiques + niveau global en berne, masqué tant que les
   grains étaient joués depuis l'impact le plus proche du secteur). 8 m
   couvre la diagonale avec de la marge et adoucit la pente. À calibrer.

   debugColor : couleur de DIAGNOSTIC (overlay debug des voix). En vue normale,
   le wireframe est monochrome — le matériau ne pilote AUCUNE couleur de scène.
   Cette teinte ne vit que dans VoiceOverlay (Ctrl+Alt+D). Source unique : ici. */
export const MATERIALS = [
  { id: 'metal', label: 'Métal', urls: sampleUrls.metal, gain: 1, minDistance: 0.5, maxDistance: 8, debugColor: 0xe8c96d },
  { id: 'bache', label: 'Bâche', urls: sampleUrls.bache, gain: 1, minDistance: 0.5, maxDistance: 8, debugColor: 0x7ec8e3 },
  { id: 'terre', label: 'Terre', urls: sampleUrls.terre, gain: 1, minDistance: 0.5, maxDistance: 8, debugColor: 0x9ae87a },
]

/* id → indice dans MATERIALS (pour les Uint8Array du terrain) */
export const MATERIAL_INDEX = Object.fromEntries(MATERIALS.map((m, i) => [m.id, i]))

export function materialById(id) {
  return MATERIALS[MATERIAL_INDEX[id]] ?? null
}

/* Invariant « matériau obligatoire » : toute surface (cellule de terrain, objet)
   DOIT porter un matériau connu. On lève ici plutôt que de retomber silencieusement
   sur un défaut — un id manquant ou inconnu est un bug de placement, pas un cas
   nominal. Point unique d'application du contrat. */
export function requireMaterial(id) {
  const m = materialById(id)
  if (!m) {
    throw new Error(`[materials] matériau requis mais introuvable : "${id}". ` +
      `Connus : ${MATERIALS.map(x => x.id).join(', ')}.`)
  }
  return m
}
