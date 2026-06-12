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
   couvre la diagonale avec de la marge et adoucit la pente. À calibrer. */
export const MATERIALS = [
  { id: 'metal', label: 'Métal', urls: sampleUrls.metal, gain: 1, minDistance: 0.5, maxDistance: 8 },
  { id: 'bache', label: 'Bâche', urls: sampleUrls.bache, gain: 1, minDistance: 0.5, maxDistance: 8 },
  { id: 'terre', label: 'Terre', urls: sampleUrls.terre, gain: 1, minDistance: 0.5, maxDistance: 8 },
]

/* id → indice dans MATERIALS (pour les Uint8Array du terrain) */
export const MATERIAL_INDEX = Object.fromEntries(MATERIALS.map((m, i) => [m.id, i]))

export function materialById(id) {
  return MATERIALS[MATERIAL_INDEX[id]] ?? null
}
