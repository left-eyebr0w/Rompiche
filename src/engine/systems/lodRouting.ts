/* ── LodRoutingSystem ─ port du routage par distance (J2) ────────────────────
   Pour chaque impact du tampon de frame : applique le cooldown de cellule, calcule
   la distance à l'auditeur, et tague la couche de destination (L1 héros vs L2/L3
   secteurs/nappe). PUR : pas d'audio. Origine : RainSampler.trigger (routage T-2.4)
   + cooldown par cellule (§13.4).

   Le cooldown est une Resource (ctx.cooldown) indexée en TEMPS LOGIQUE (déterministe,
   §7) — pas performance.now() comme en v0, qui casserait le déterminisme. */

import { listenerWorld } from './head.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'

/* Anti-mitraillage par cellule (0,5 m) : 80 ms (v0 COOLDOWN_MS). */
const COOLDOWN_S = 0.08

/* Clé de cellule (grille fine 0,5 m), comme RainSampler._cellKey. */
function cellKey(ctx: EngineContext, x: number, z: number): number {
  const { half, CELL, size } = ctx.coords
  const cols = Math.ceil(size / CELL)
  const c = Math.floor((x + half) / CELL)
  const r = Math.floor((z + half) / CELL)
  return r * cols + c
}

export function createLodRoutingSystem(): System {
  return (ctx) => {
    const head = listenerWorld(ctx)
    const { r1, r2, overlap } = ctx.bands
    const now = ctx.time.seconds

    for (const imp of ctx.frame.impacts) {
      /* Cooldown : rejette un 2ᵉ impact trop rapproché sur la même cellule
         (impact laissé sans couche → ignoré en aval). */
      const key = cellKey(ctx, imp.pos.x, imp.pos.z)
      const last = ctx.cooldown.get(key) ?? -Infinity
      if (now - last < COOLDOWN_S) continue
      ctx.cooldown.set(key, now)

      const dx = imp.pos.x - head.x
      const dy = imp.pos.y - head.y
      const dz = imp.pos.z - head.z
      const dist = Math.hypot(dx, dy, dz)
      imp.dist = dist

      /* Routage par distance (v0) : héros L1 si proche, sinon secteurs L2 puis nappe L3. */
      imp.layer = dist >= r1 - overlap
        ? (dist < r2 ? 'L2' : 'L3')
        : 'L1'
    }
  }
}
