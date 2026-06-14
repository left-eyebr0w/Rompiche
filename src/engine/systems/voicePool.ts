/* ── VoicePoolSystem ─ port du pool de voix (J2) ─────────────────────────────
   Alloue une voix de pool à chaque impact routé L1 ; vole la voix de plus basse
   priorité quand le pool est saturé, et pousse une démotion (ctx.frame.demotions)
   pour que l'audio applique le fade-out (J3). PUR : la priorité se calcule sur la
   géométrie + le gain + l'âge LOGIQUE (pas l'analyser audio). Origine : VoicePool
   (RainSampler) — _priority / _lowestPriority / acquire / release.

   Libération : faute de durée d'échantillon réelle (audio en J3), on utilise une
   durée de grain nominale en temps logique. */

import { materialById } from '../components/materials.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { Voice } from '../ecs/Entity.js'
import type { Vector3 } from '../context/coords.js'

/* Durée nominale d'un grain (s) — placeholder jusqu'à la vraie durée PCM (J3). */
const GRAIN_DURATION_S = 0.3

/* Attention : 1 si la voix est dans le champ avant de la tête, 0.4 sinon (v0 T-4.7).
   LISTENER_FORWARD = (0,0,−1) → demi-espace avant z<0 côté auditeur. */
function attention(vPos: Vector3, head: Vector3): number {
  const dx = vPos.x - head.x
  const dz = vPos.z - head.z
  const l = Math.hypot(dx, dz)
  if (l < 1e-6) return 1
  return (dz * -1) / l > 0 ? 1 : 0.4
}

export function createVoicePoolSystem(world: GameWorld, ctx: EngineContext): System {
  const pool = world.with('voice')
  const w = ctx.worldConfig.layers.L1.priorité
  const r2 = ctx.bands.r2

  function priority(v: Voice, head: Vector3, now: number): number {
    const gainNorm = Math.min(1, Math.max(0, (v.gainDb + 60) / 60))
    const distNorm = Math.min(1, v.dist / (r2 || 1))
    const ageNorm = Math.min(1, (now - v.startedAt) / 1)
    return w.w_gain * gainNorm + w.w_dist * (1 - distNorm) + w.w_att * attention(v.pos, head) - w.w_age * ageNorm
  }

  return (c) => {
    const now = c.time.seconds
    const head = c.headWorldPos

    /* 1) Libère les voix dont le grain est terminé (durée logique). */
    for (const e of pool) {
      const v = e.voice!
      if (v.busy && now - v.startedAt >= v.duration) {
        v.busy = false
        v.materialId = null
      }
    }

    /* 2) Une voix par impact L1 : voix libre, sinon vol de la plus basse priorité. */
    for (const imp of c.frame.impacts) {
      if (imp.layer !== 'L1') continue
      if (!materialById(imp.surface)) continue

      let target: Voice | null = null
      let lowest: Voice | null = null
      let bestP = Infinity
      for (const e of pool) {
        const v = e.voice!
        if (!v.busy) { target = v; break }
        const p = priority(v, head, now)
        if (p < bestP) { bestP = p; lowest = v }
      }

      let stolen = false
      if (!target) { target = lowest; stolen = true }
      if (!target) continue // pool vide (aucune entité voice)

      if (stolen) c.frame.demotions.push({ voice: target.id })

      const dx = imp.pos.x - head.x
      const dy = imp.pos.y - head.y
      const dz = imp.pos.z - head.z
      target.busy = true
      target.materialId = imp.surface
      target.sample = imp.sample
      target.grain = imp.detune
      target.gainDb = 0
      target.dist = Math.hypot(dx, dy, dz)
      target.pos = { x: imp.pos.x, y: imp.pos.y, z: imp.pos.z }
      target.startedAt = now
      target.duration = GRAIN_DURATION_S

      /* Onset : la voix vient d'être (ré)acquise → l'AudioSync joue un nouveau grain.
         Sur un vol, la démotion (cut) ET l'onset (start) pointent la même voix :
         l'AudioSync traite les démotions AVANT les onsets → coupe puis redémarre. */
      c.frame.grainOnsets.push({ voice: target.id })
    }
  }
}
