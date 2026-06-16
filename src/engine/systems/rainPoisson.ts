/* ── RainPoissonSystem ─ pool unique spatial (remplace partition par matériau) ─
   Génère les impacts de pluie par processus de Poisson sur un pool unique de tous
   les points du terrain. Le matériau de l'impact est celui du vertex sélectionné
   (pas de partition byMat). Les overlays coupés (surfaces=0) révèlent la terre.
   PUR : ne touche PAS l'audio.

   Simplification J4 : plus de Passe 1 (poids par matériau) ni de boucle sid.
   Un seul flux Poisson, un seul pickImpact par grain. */

import { pickImpact, type TerrainVertex, type SpatialField } from '../world/terrainMesh.js'
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
    const head = c.headWorldPos
    /* Débit du flux HÉROS L1 = l1Field.rate (grains/s à density=1), scalé par la
       densité UI. Réglable live via l'overlay debug (slider « débit /s »).
       (dropletRate reste réservé au futur flux BULK L2/L3, non implémenté ici.) */
    const rateMs = (c.worldConfig.l1Field.rate * density) / 1000
    /* Le champ SPATIAL (pickImpact) n'utilise que core/sigma/p/floor/ky ; on retire
       `rate` qui est un débit, pas un paramètre de forme. */
    const field: SpatialField = (() => {
      const { rate: _r, ...rest } = c.worldConfig.l1Field; return rest
    })()

    /* Construire le pool dynamique : garder les seules cellules exposées au ciel.
       (Le terrain et les objets sont déjà fusionnés dans impactPoints().) */
    scratch.length = 0
    for (let i = 0; i < mesh.length; i++) {
      const v = mesh[i]
      if (v.expoCiel <= 0) continue
      scratch.push(v)
    }
    if (scratch.length === 0) return

    /* Un seul flux Poisson (plus de boucle par matériau) */
    const ps = c.poisson.terre  // réutilise le slot terre comme état unique
    /* accStart = crédit reporté du tick précédent ; on étale les onsets dans la
       fenêtre [0, dtMs] en suivant l'instant Poisson de chaque goutte. */
    const accStart = ps.acc
    ps.acc += dtMs
    let grains = 0
    let cum = 0  // somme des intervalles consommés ce tick (ms)
    while (ps.acc >= ps.next) {
      if (grains >= maxGrains) { ps.acc = 0; break }
      grains++
      cum += ps.next
      ps.acc -= ps.next
      /* Instant de la goutte dans le tick : l'accumulateur se remplit de accStart
         à accStart+dtMs ; la goutte se déclenche quand il franchit cum. */
      const offset = Math.min(dtMs, Math.max(0, cum - accStart)) / 1000
      const u = Math.max(1e-9, c.prng.aléa())
      ps.next = -Math.log(u) / rateMs

      const point = pickImpact(scratch, c.prng, head, field)
      if (!point) continue

      /* Échantillon tiré UNIFORMÉMENT dans le banc réel du matériau (PRNG seedé →
         déterministe). L'ancien round-robin séquentiel (% 64) parcourait les timbres
         dans un ordre figé → boucle perçue tous les 64 grains, et index hors-borne
         pour les petits bancs → grains muets. */
      const n = c.sampleCounts[point.matériau]
      const sample = n > 0 ? Math.floor(c.prng.aléa() * n) : 0
      const detune = (c.prng.aléa() - 0.5) * 40

      c.frame.impacts.push({
        surface: point.matériau,
        pos: { x: point.position.x, y: point.position.y, z: point.position.z },
        detune,
        sample,
        offset,
      })
    }
  }
}
