/* ── Sauvegarde du monde · le format pivot versionné (cadrage-v1 §4) ──────────
   WorldSave est le format unique, versionné DÈS LE JOUR 1, qui sérialise tout
   l'état rejouable d'une scène. Le terrain est OPAQUE derrière une union
   discriminée par `kind` : aujourd'hui 'flat-grid' (deux Uint8Array), demain
   'sdf-chunks' (P3) — un loader connaîtra les deux et migrate() comblera l'écart.
   C'est ce champ `kind` qui permet d'ajouter le SDF sans casser les saves plates.

   Persistance : IndexedDB (slots nommés). Pas localStorage (trop petit), pas de
   dépendance externe (idb) — une fine couche maison suffit en v1. */

import { Terrain } from '../engine/world/Terrain.js'
import type { MaterialId } from '../engine/components/materials.js'
import type { WorldObject } from '../engine/world/objects.js'
import type { DioramaStatePatch } from '../shared/state.js'

/* Version courante du schéma. À INCRÉMENTER à chaque changement de structure,
   en ajoutant une branche dans migrate(). v2 : grilles compressées RLE.
   v3 : retrait du champ `preset` (Rompiche est un diorama unique). */
export const SAVE_VERSION = 3 as const

/* Grilles encodées en run-length : suite plate de paires [valeur, répétition].
   Les terrains plats (vastes plages de même matériau / hauteur 0) se compressent
   d'un facteur ~100. Décode en Uint8Array de longueur connue. */
export type RleGrid = number[]

export type TerrainPayload =
  | { kind: 'flat-grid'; size: number; cell: number; block: number; material: RleGrid; height: RleGrid }
  // | { kind: 'sdf-chunks'; … }  ← P3, futur. La place est réservée par `kind`.

/* ── Run-length encoding des grilles Uint8Array ───────────────────────────────
   Format : [v0, n0, v1, n1, …] où vi répété ni fois. Σ ni = longueur d'origine. */
export function rleEncode(arr: Uint8Array): RleGrid {
  const out: number[] = []
  let i = 0
  while (i < arr.length) {
    const v = arr[i]
    let n = 1
    while (i + n < arr.length && arr[i + n] === v) n++
    out.push(v, n)
    i += n
  }
  return out
}

export function rleDecode(rle: RleGrid): Uint8Array {
  let len = 0
  for (let k = 1; k < rle.length; k += 2) len += rle[k]
  const out = new Uint8Array(len)
  let p = 0
  for (let k = 0; k < rle.length; k += 2) {
    const v = rle[k], n = rle[k + 1]
    out.fill(v, p, p + n)
    p += n
  }
  return out
}

export interface WorldSave {
  version: number
  meta: { voxelSize: number; scale: '1u=1m'; createdAt: string; name: string }
  materials: MaterialId[]
  terrain: TerrainPayload
  objects: WorldObject[]
  seed: number
  /** Sous-ensemble sérialisable de l'état UI (toggles, sliders, position…). */
  state: DioramaStatePatch
}

/* Champs de l'état UI qui méritent d'être sauvegardés (les refs/handles audio,
   le debug et les valeurs purement éphémères sont exclus). */
const SAVED_STATE_KEYS: (keyof DioramaStatePatch)[] = [
  'rain', 'wind', 'windTilt', 'windRotation', 'windForce',
  'metal', 'bache', 'x', 'y', 'z', 'density', 'gain',
  'spin', 'zoom', 'clockMode', 'clockSegment', 'seed', 'platform',
]

function pickState(state: DioramaStatePatch): DioramaStatePatch {
  const out: DioramaStatePatch = {}
  for (const k of SAVED_STATE_KEYS) {
    if (state[k] !== undefined) (out as Record<string, unknown>)[k] = state[k]
  }
  return out
}

/* ── Sérialisation ──────────────────────────────────────────────────────────── */

export function serializeWorld(
  name: string,
  state: DioramaStatePatch,
  terrain: Terrain,
  objects: WorldObject[],
  materials: MaterialId[],
): WorldSave {
  return {
    version: SAVE_VERSION,
    meta: { voxelSize: terrain.cell, scale: '1u=1m', createdAt: new Date().toISOString(), name },
    materials,
    terrain: {
      kind: 'flat-grid',
      size: terrain.size,
      cell: terrain.cell,
      block: terrain.block,
      /* Grilles compressées RLE (paires [valeur, répétition]) — sérialisable JSON. */
      material: rleEncode(terrain.material),
      height: rleEncode(terrain.height),
    },
    objects,
    seed: state.seed ?? 1,
    state: pickState(state),
  }
}

/* ── Migration de version (fonction pure vN → vN+1) ───────────────────────────
   Aujourd'hui no-op (une seule version). Le squelette existe pour que P3 ajoute
   ses branches sans casser les saves 'flat-grid'. */
export function migrate(save: WorldSave): WorldSave {
  let s = save
  while (s.version < SAVE_VERSION) {
    switch (s.version) {
      case 2: s = migrate_2_to_3(s); break
      default:
        throw new Error(`[save] version inconnue ${s.version}`)
    }
  }
  return s
}

/* v2 → v3 : retrait du champ `preset`. Les anciennes saves portaient un preset
   ('diorama'|'room'|…) ; on le supprime du payload racine et de l'état UI. */
function migrate_2_to_3(save: WorldSave): WorldSave {
  const next = { ...save, version: 3 } as WorldSave & { preset?: unknown }
  delete next.preset
  if (next.state && 'preset' in next.state) {
    next.state = { ...next.state }
    delete (next.state as Record<string, unknown>).preset
  }
  return next
}

export function deserializeWorld(save: WorldSave): { statePatch: DioramaStatePatch; terrain: Terrain } {
  const s = migrate(save)
  if (s.terrain.kind !== 'flat-grid') {
    throw new Error(`[save] terrain kind non supporté en v1 : ${(s.terrain as { kind: string }).kind}`)
  }
  const tp = s.terrain
  const terrain = new Terrain({ size: tp.size, cell: tp.cell, block: tp.block })
  terrain.material = rleDecode(tp.material)
  terrain.height = rleDecode(tp.height)
  return { statePatch: s.state, terrain }
}

/* ── Couche IndexedDB (slots nommés) ──────────────────────────────────────────
   DB 'rompiche', store 'saves' keyé par nom. API promisifiée minimale. */

const DB_NAME = 'rompiche'
const STORE = 'saves'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'name' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  }))
}

interface SaveRecord { name: string; save: WorldSave }

export function putSave(name: string, save: WorldSave): Promise<void> {
  return tx<IDBValidKey>('readwrite', s => s.put({ name, save } as SaveRecord)).then(() => undefined)
}

export function getSave(name: string): Promise<WorldSave | null> {
  return tx<SaveRecord | undefined>('readonly', s => s.get(name)).then(r => r?.save ?? null)
}

export function deleteSave(name: string): Promise<void> {
  return tx<undefined>('readwrite', s => s.delete(name)).then(() => undefined)
}

export function listSaves(): Promise<string[]> {
  return tx<IDBValidKey[]>('readonly', s => s.getAllKeys()).then(keys => keys.map(String))
}
