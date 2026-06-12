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

export const MATERIALS = [
  { id: 'metal', label: 'Métal', urls: sampleUrls.metal, gain: 1, minDistance: 0.5, maxDistance: 4 },
  { id: 'bache', label: 'Bâche', urls: sampleUrls.bache, gain: 1, minDistance: 0.5, maxDistance: 4 },
  { id: 'terre', label: 'Terre', urls: sampleUrls.terre, gain: 1, minDistance: 0.5, maxDistance: 4 },
]

/* id → indice dans MATERIALS (pour les Uint8Array du terrain) */
export const MATERIAL_INDEX = Object.fromEntries(MATERIALS.map((m, i) => [m.id, i]))

export function materialById(id) {
  return MATERIALS[MATERIAL_INDEX[id]] ?? null
}
