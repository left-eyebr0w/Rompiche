/* ── ObjectMesh — faces des objets posés → vertices d'impact ──────────────────
   Pendant de terrainMesh.ts pour la couche objets (objects.ts). Échantillonne les
   faces EXPOSÉES AU CIEL d'une primitive boîte en TerrainVertex, que le pivot
   WorldQuery fusionne ensuite au pool du terrain (World.ts). La pluie frappe alors
   les objets exactement comme le sol : même type, même pickImpact, même routage
   L1/L2/L3 par distance 3D — c'est ce qui rend la spatialité/élévation validable.

   Deux choses RÉELLES, dès maintenant (cf. cadrage 04 §5) :
     • la POSITION en hauteur (faces au-dessus du sol),
     • la NORMALE réelle de chaque face (pour l'audio nearestSurface + futur vent),
   même si la PDF (spatialWeight) ignore encore la normale.

   Densité d'échantillonnage = pas du terrain (coords.CELL) → une grande face porte
   plus de points, donc reçoit plus de gouttes : le débit Poisson reste cohérent
   entre sol et objets (un seul pool, pondéré par surface réelle).

   PAS de dépendance three.js : données pures, typées (comme terrainMesh). */

import type { TerrainVertex } from './terrainMesh.js'
import type { WorldObject } from './objects.js'
import type { SkyOcclusion } from './skyOcclusion.js'
import type { Coords, Vector3 } from '../context/coords.js'

/* Filtrage des FACES CACHÉES (cadrage 07) — un vertex n'entre dans le pool que si
   sa NORMALE pointe assez vers le haut ET que rien ne le surplombe (SkyOcclusion).

   Seuil d'orientation : une face reçoit la pluie ssi sa normale pointe assez vers
   le haut. 0,5 ≈ 60° d'inclinaison max ; les flancs verticaux (n·Y = 0) sont
   écartés, le dessus (+Y, n·Y = 1) passe. Réglage de calibration. */
export const UP_THRESHOLD = 0.5

/* Les 5 faces utiles d'une boîte (le DESSOUS, −Y, ne reçoit pas la pluie → ignoré).
   Chaque face : sa normale monde + les deux axes locaux qui la balaient (u, v). */
interface Face {
  normale: Vector3
  /** Axe parcouru en u (unitaire) et l'index size de son étendue (0=w,1=h,2=d). */
  uAxis: Vector3; uExt: 0 | 1 | 2
  /** Axe parcouru en v (unitaire) et l'index size de son étendue. */
  vAxis: Vector3; vExt: 0 | 1 | 2
}

const X: Vector3 = { x: 1, y: 0, z: 0 }
const Y: Vector3 = { x: 0, y: 1, z: 0 }
const Z: Vector3 = { x: 0, y: 0, z: 1 }

const FACES: Face[] = [
  // +Y (dessus) : balaye le plan XZ
  { normale: { x: 0, y: 1, z: 0 }, uAxis: X, uExt: 0, vAxis: Z, vExt: 2 },
  // +X / −X (côtés est/ouest) : balayent le plan ZY
  { normale: { x: 1, y: 0, z: 0 }, uAxis: Z, uExt: 2, vAxis: Y, vExt: 1 },
  { normale: { x: -1, y: 0, z: 0 }, uAxis: Z, uExt: 2, vAxis: Y, vExt: 1 },
  // +Z / −Z (côtés sud/nord) : balayent le plan XY
  { normale: { x: 0, y: 0, z: 1 }, uAxis: X, uExt: 0, vAxis: Y, vExt: 1 },
  { normale: { x: 0, y: 0, z: -1 }, uAxis: X, uExt: 0, vAxis: Y, vExt: 1 },
]

/* Centres d'échantillonnage le long d'une étendue `len`, espacés de ~step, centrés.
   Au moins 1 point (objet plus petit que la maille → un point central). */
function sampleCenters(len: number, step: number): number[] {
  const n = Math.max(1, Math.round(len / step))
  const cell = len / n
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(-len / 2 + (i + 0.5) * cell)
  return out
}

/** Échantillonne les faces d'un objet boîte en TerrainVertex, en écartant les
    faces cachées (cadrage 07) :
      • filtre de NORMALE : seules les faces tournées assez vers le haut (n·Y ≥
        UP_THRESHOLD) reçoivent la pluie verticale → les 4 flancs et le dessous
        sont sautés ;
      • filtre d'OCCLUSION : chaque point gardé est marqué abrité (expoCiel = 0)
        si quelque chose le surplombe (terrain plus haut, autre boîte au-dessus).
    `occlusion` est optionnel pour rester rétro-compatible (objet isolé → ciel
    ouvert), mais World.ts le fournit toujours en pratique. */
export function buildObjectVertices(obj: WorldObject, coords: Coords, occlusion?: SkyOcclusion): TerrainVertex[] {
  const step = coords.CELL
  const [w, h, d] = obj.size
  const half: [number, number, number] = [w / 2, h / 2, d / 2]
  const [cx, cy, cz] = obj.position
  const out: TerrainVertex[] = []

  for (const f of FACES) {
    /* Filtre de normale : on ne garde que les faces tournées vers le haut. */
    if (f.normale.y < UP_THRESHOLD) continue

    const us = sampleCenters(obj.size[f.uExt], step)
    const vs = sampleCenters(obj.size[f.vExt], step)
    for (const u of us) {
      for (const v of vs) {
        const px = cx + f.normale.x * half[0] + f.uAxis.x * u + f.vAxis.x * v
        const py = cy + f.normale.y * half[1] + f.uAxis.y * u + f.vAxis.y * v
        const pz = cz + f.normale.z * half[2] + f.uAxis.z * u + f.vAxis.z * v
        out.push({
          position: { x: px, y: py, z: pz },
          normale: f.normale,
          matériau: obj.materialId,
          expoCiel: occlusion?.isSheltered(px, py, pz) ? 0 : 1,
        })
      }
    }
  }

  return out
}
