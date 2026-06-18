/* ── RainPoissonSystem ─ DEUX flux de Poisson indépendants (notes/random/pluie.txt) ─
   Génère les impacts de pluie ponctuels par DEUX processus de Poisson indépendants :
     • L1 (héros, proche)  : λ = rain.lambdaL1, tire dans le disque  d ∈ [0, rL1]
     • L2 (lointain)        : λ = rain.lambdaL2, tire dans l'anneau d ∈ [rL1, rMaxL2]
   La couche est décidée PAR LE FLUX (plus de routage zonal probabiliste a posteriori) ;
   chaque goutte porte un `mix` ∈ [0,1] DÉRIVÉ de sa distance réelle, qui pilote le
   timbre côté audio (0 = L1 pur, 1 = L2 lointain pur). Le placement passe par des
   buckets pré-triés par zone (RainBuckets) → tirage O(1), pas de raycast au tir.

   Le matériau de l'impact est celui du vertex sélectionné. Cooldown par cellule
   (anti-mitraillage) appliqué ici en TEMPS LOGIQUE (déterministe, §7).
   PUR : ne touche PAS l'audio. */

import { pickImpact, RainBuckets, type TerrainVertex } from '../world/terrainMesh.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { PoissonState } from '../context/EngineContext.js'

/* Clé de cellule (grille fine), comme l'ancien LodRoutingSystem. */
function cellKey(ctx: EngineContext, x: number, z: number): number {
  const { half, CELL, size } = ctx.coords
  const cols = Math.ceil(size / CELL)
  const c = Math.floor((x + half) / CELL)
  const r = Math.floor((z + half) / CELL)
  return r * cols + c
}

export function createRainPoissonSystem(world: GameWorld, ctx: EngineContext): System {
  const emitters = world.with('rainEmitter')
  const mesh = ctx.world.impactPoints() as TerrainVertex[]
  const buckets = new RainBuckets(mesh)
  /* Plafond de grains par tick et par flux : borne le coût d'une rafale de catchup
     (le pool de voix gère ensuite le vol). */
  const maxL1 = Math.max(4, ctx.worldConfig.layers.L1.voices)
  const maxL2 = Math.max(4, ctx.worldConfig.layers.L2.voicesMax)

  return (c, dt) => {
    let density = 0
    for (const e of emitters) if (e.rainEmitter!.active) { density = e.rainEmitter!.density; break }
    if (density <= 0) return

    const { lambdaL1, lambdaL2, rL1, rMaxL2, regimeMult } = c.worldConfig.rain
    const head = c.headWorldPos
    const dtMs = dt * 1000
    const now = c.time.seconds
    const cooldownS = c.worldConfig.grain.cooldownS

    /* Re-trier les buckets si la tête a bougé / les rayons ont changé (amorti). */
    buckets.update(head, rL1, rMaxL2)

    /* Émet un flux Poisson de couche `layer` depuis `pool`, débit `rateMs` (gouttes/ms).
       Étale les onsets dans la fenêtre [0, dtMs] (instant Poisson de chaque goutte). */
    function emit(ps: PoissonState, rateMs: number, pool: readonly TerrainVertex[], layer: 'L1' | 'L2', maxGrains: number): void {
      if (rateMs <= 0 || pool.length === 0) return
      const accStart = ps.acc
      ps.acc += dtMs
      let grains = 0
      let cum = 0
      while (ps.acc >= ps.next) {
        if (grains >= maxGrains) { ps.acc = 0; break }
        grains++
        cum += ps.next
        ps.acc -= ps.next
        const offset = Math.min(dtMs, Math.max(0, cum - accStart)) / 1000
        const u = Math.max(1e-9, c.prng.aléa())
        ps.next = -Math.log(u) / rateMs

        const point = pickImpact(pool, c.prng)
        if (!point) continue

        /* Cooldown de cellule : rejette un 2ᵉ impact trop rapproché sur la même cellule. */
        const key = cellKey(c, point.position.x, point.position.z)
        const last = c.cooldown.get(key) ?? -Infinity
        if (now - last < cooldownS) continue
        c.cooldown.set(key, now)

        /* Échantillon + détune tirés uniformément (PRNG seedé → déterministe). */
        const n = c.sampleCounts[point.matériau]
        const sample = n > 0 ? Math.floor(c.prng.aléa() * n) : 0
        const detune = (c.prng.aléa() - 0.5) * c.worldConfig.grain.detuneSpan

        /* Distance horizontale réelle + mix de timbre. L1 = 0 (timbre proche pur) ;
           L2 = position dans l'anneau [rL1, rMaxL2] (0 au bord interne → 1 au bord externe). */
        const dx = point.position.x - head.x
        const dz = point.position.z - head.z
        const dist = Math.hypot(dx, dz)
        const span = rMaxL2 - rL1
        const mix = layer === 'L1' || span <= 0
          ? 0
          : Math.min(1, Math.max(0, (dist - rL1) / span))

        c.frame.impacts.push({
          surface: point.matériau,
          pos: { x: point.position.x, y: point.position.y, z: point.position.z },
          detune,
          sample,
          offset,
          layer,
          dist,
          mix,
        })
      }
    }

    /* Débit effectif d'un flux = λ × regimeMult × density (gouttes/s → /ms). */
    const scale = (regimeMult * density) / 1000
    emit(c.poisson.L1, lambdaL1 * scale, buckets.L1, 'L1', maxL1)
    emit(c.poisson.L2, lambdaL2 * scale, buckets.L2, 'L2', maxL2)
  }
}
