/* ── RainPoissonSystem ─ pool unique spatial (remplace partition par matériau) ─
   Génère les impacts de pluie par processus de Poisson sur un pool unique de tous
   les points du terrain. Le matériau de l'impact est celui du vertex sélectionné
   (pas de partition byMat). Les overlays coupés (surfaces=0) révèlent la terre.
   PUR : ne touche PAS l'audio.

   Simplification J4 : plus de Passe 1 (poids par matériau) ni de boucle sid.
   Un seul flux Poisson, un seul pickImpact par grain. */

import { MATERIALS, type MaterialId } from '../components/materials.js'
import { pickImpact, type TerrainVertex, type SpatialField } from '../world/terrainMesh.js'
import { listenerWorld } from './head.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'

/* Plafond de grains par tick, calibré sur le pool de voix (v0). */
function maxGrainsPerTick(voices: number): number {
  return Math.max(4, voices)
}

export function createRainPoissonSystem(world: GameWorld, ctx: EngineContext): System {
  const emitters = world.with('rainEmitter')
  const maxGrains = maxGrainsPerTick(ctx.worldConfig.layers.L1.voices)
  const mesh = ctx.world.impactPoints() as TerrainVertex[]
  const scratch: TerrainVertex[] = []   // pool dynamique, réalloué chaque tick

  return (c, dt) => {
    let density = 0
    for (const e of emitters) if (e.rainEmitter!.active) { density = e.rainEmitter!.density; break }
    if (density <= 0) return

    const dtMs = dt * 1000
    const head = listenerWorld(c)
    const rateMs = (c.worldConfig.dropletRate * density) / 1000
    const field: SpatialField = (() => {
      const { rate: _r, ...rest } = c.worldConfig.l1Field; return rest
    })()

    /* Construire le pool dynamique :
       – garder les cellules exposées au ciel seulement
       – les overlays coupés (surfaces[sid] ≤ 0) révèlent la terre */
    scratch.length = 0
    for (let i = 0; i < mesh.length; i++) {
      const v = mesh[i]
      if (v.expoCiel <= 0) continue
      const mat = (c.surfaces[v.matériau] ?? 1) <= 0 ? 'terre' as MaterialId : v.matériau
      if (mat !== v.matériau) {
        scratch.push({ ...v, matériau: mat })
      } else {
        scratch.push(v)
      }
    }
    if (scratch.length === 0) return

    /* Un seul flux Poisson (plus de boucle par matériau) */
    const ps = c.poisson.terre  // réutilise le slot terre comme état unique
    ps.acc += dtMs
    let grains = 0
    while (ps.acc >= ps.next) {
      if (grains >= maxGrains) { ps.acc = 0; break }
      grains++
      ps.acc -= ps.next
      const u = Math.max(1e-9, c.prng.aléa())
      ps.next = -Math.log(u) / rateMs

      const point = pickImpact(scratch, c.prng, head, field)
      if (!point) continue

      ps.rr = (ps.rr + 1) % 64
      const detune = (c.prng.aléa() - 0.5) * 40

      c.frame.impacts.push({
        surface: point.matériau,
        pos: { x: point.position.x, y: point.position.y, z: point.position.z },
        detune,
        sample: ps.rr,
      })
    }
  }
}
