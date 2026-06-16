import { requireMaterial, type MaterialId } from '../components/materials.js'
import type { Coords } from '../context/coords.js'

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

/* Scène de TEST debug (cadrage 04 §5) : terrain plat + objets de matières variées
   à hauteurs/directions variées AUTOUR de l'auditeur (au repos à ground+EAR). But
   unique : valider à l'oreille la spatialité et l'élévation — entendre les impacts
   venir d'en haut / des côtés selon l'objet frappé. Source unique de la scène debug.

   Positions en mètres-monde. Y = base de l'objet posée à `ground + h/2` (boîte
   centrée sur sa position) sauf objets surélevés, qui flottent à hauteur d'oreille
   pour être bien au-dessus/autour de la tête. */
export function makeTestScene(coords: Coords): WorldObject[] {
  const { ground, EAR } = coords
  const ear = ground + EAR        // niveau d'oreille de l'auditeur au repos (~−10.9)

  return [
    // Boîte métal surélevée, devant-gauche, au-dessus de l'oreille → impacts d'en haut.
    makeObject({ id: 'caisse-metal', materialId: 'metal', size: [2, 2, 2], position: [-4, ear + 1.5, -4] }),
    // Dalle bâche large et basse, derrière-droite, légèrement au-dessus du sol.
    makeObject({ id: 'dalle-bache', materialId: 'bache', size: [4, 0.4, 4], position: [4, ground + 1.2, 4] }),
    // Colonne terre haute, sur la droite, à hauteur de tête → impacts latéraux nets.
    makeObject({ id: 'colonne-terre', materialId: 'terre', size: [1.5, 3, 1.5], position: [5, ear, 0] }),
    // Tôle métal inclinable (plate), à gauche, au niveau de l'oreille.
    makeObject({ id: 'tole-metal', materialId: 'metal', size: [3, 0.3, 2], position: [-5, ear, 2] }),
  ]
}
