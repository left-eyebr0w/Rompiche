import { requireMaterial, type MaterialId } from '../components/materials.js'

/* ── Couche objets · props placés dans le monde ──────────────────────────────
   Le terrain (Terrain.ts) est le substrat STATIQUE baké : sol + relief sur grille.
   Les objets sont une couche de PLACEMENT séparée, par-dessus le terrain — des
   props discrets (un bidon, une tôle, une caisse…), potentiellement mobiles à
   terme (raycast à la frappe, cf. SPEC « objets mobiles » — Phase ultérieure).

   Invariant partagé avec le terrain : tout ce que la pluie peut frapper a un
   matériau (« NÉCESSAIREMENT »). makeObject valide ce contrat à la construction
   via requireMaterial — impossible de créer un objet sans matériau connu.

   Forme d'un WorldObject :
     { id, materialId, size:[w,h,d], position:[x,y,z] }
   size/position sont en unités-monde (cf. coords.ts). C'est délibérément minimal :
   un volume + un matériau, suffisant pour le rendu wireframe unifié et compatible
   avec un futur « Gamemaster » qui composerait/animerait la scène. */

export interface WorldObject {
  id: string
  materialId: MaterialId
  /** Dimensions [largeur, hauteur, profondeur] en mètres */
  size: [number, number, number]
  /** Position monde [x, y, z] en mètres */
  position: [number, number, number]
}

export function makeObject({ id, materialId, size, position }: WorldObject): WorldObject {
  requireMaterial(materialId) // invariant : matériau obligatoire (lève si inconnu)
  if (!Array.isArray(size) || size.length !== 3) {
    throw new Error(`[objects] size doit être [w,h,d] (objet "${id}")`)
  }
  if (!Array.isArray(position) || position.length !== 3) {
    throw new Error(`[objects] position doit être [x,y,z] (objet "${id}")`)
  }
  return { id, materialId, size, position }
}

/* Aucun objet par défaut : la couche est prête mais vide tant que la scène (ou un
   futur Gamemaster) n'en place pas. Établit le chemin de données sans rien afficher. */
export function makeDefaultObjects(): WorldObject[] {
  return []
}
