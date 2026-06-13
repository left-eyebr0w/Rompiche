/* ── Sauvegarde du monde · le format pivot versionné (cadrage-v1 §4) ──────────
   WorldSave est le format unique, versionné DÈS LE JOUR 1, qui sérialise tout
   l'état rejouable d'une scène. Le terrain est OPAQUE derrière une union
   discriminée par `kind` : aujourd'hui 'flat-grid' (deux Uint8Array), demain
   'sdf-chunks' (P3) — un loader connaîtra les deux et migrate() comblera l'écart.
   C'est ce champ `kind` qui permet d'ajouter le SDF sans casser les saves plates.

   Persistance : IndexedDB (slots nommés). Pas localStorage (trop petit), pas de
   dépendance externe (idb) — une fine couche maison suffit en v1. */

import { Terrain } from './Terrain.js'
import type { MaterialId } from './materials.js'
import type { WorldObject } from './objects.js'
import type { DioramaStatePatch, Preset } from './state.js'

/* Version courante du schéma. À INCRÉMENTER à chaque changement de structure,
   en ajoutant une branche dans migrate(). */
export const SAVE_VERSION = 1 as const

export type TerrainPayload =
  | { kind: 'flat-grid'; size: number; cell: number; block: number; material: number[]; height: number[] }
  // | { kind: 'sdf-chunks'; … }  ← P3, futur. La place est réservée par `kind`.

export interface WorldSave {
  version: number
  meta: { voxelSize: number; scale: '1u=1m'; createdAt: string; name: string }
  materials: MaterialId[]
  terrain: TerrainPayload
  objects: WorldObject[]
  seed: number
  preset: Preset
  /** Sous-ensemble sérialisable de l'état UI (toggles, sliders, position…). */
  state: DioramaStatePatch
}

/* Champs de l'état UI qui méritent d'être sauvegardés (les refs/handles audio,
   le debug et les valeurs purement éphémères sont exclus). */
const SAVED_STATE_KEYS: (keyof DioramaStatePatch)[] = [
  'rain', 'wind', 'windTilt', 'windRotation', 'windForce',
  'metal', 'bache', 'x', 'y', 'z', 'density', 'gain',
  'spin', 'zoom', 'clockMode', 'clockSegment', 'preset', 'seed', 'platform',
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
      /* Uint8Array → Array : sérialisable JSON tel quel. RLE repoussé à plus tard. */
      material: Array.from(terrain.material),
      height: Array.from(terrain.height),
    },
    objects,
    seed: state.seed ?? 1,
    preset: state.preset ?? 'diorama',
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
      // case 1: s = migrate_1_to_2(s); break
      default:
        throw new Error(`[save] version inconnue ${s.version}`)
    }
  }
  return s
}

export function deserializeWorld(save: WorldSave): { statePatch: DioramaStatePatch; terrain: Terrain } {
  const s = migrate(save)
  if (s.terrain.kind !== 'flat-grid') {
    throw new Error(`[save] terrain kind non supporté en v1 : ${(s.terrain as { kind: string }).kind}`)
  }
  const tp = s.terrain
  const terrain = new Terrain({ size: tp.size, cell: tp.cell, block: tp.block })
  terrain.material = Uint8Array.from(tp.material)
  terrain.height = Uint8Array.from(tp.height)
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
