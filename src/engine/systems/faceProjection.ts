import { HEAD_FACES } from '../context/coords.js'
import { listenerWorld } from './head.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'

function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function norm3(v: [number, number, number]): [number, number, number] {
  const l = Math.sqrt(dot3(v, v)) || 1e-9
  return [v[0] / l, v[1] / l, v[2] / l]
}

export function createFaceProjectionSystem(world: GameWorld): System {
  const voices = world.with('voice')

  return (ctx: EngineContext) => {
    const head = listenerWorld(ctx)
    const hp: [number, number, number] = [head.x, head.y, head.z]
    const sums = [0, 0, 0, 0, 0, 0]

    for (const e of voices) {
      const v = e.voice!
      if (!v.busy) continue

      const lin = isFinite(v.levelDb) ? Math.pow(10, v.levelDb / 20) : 0
      if (lin < 1e-9) continue

      const dx = v.pos.x - hp[0]
      const dy = v.pos.y - hp[1]
      const dz = v.pos.z - hp[2]
      const dir = norm3([dx, dy, dz])

      for (let i = 0; i < 6; i++) {
        sums[i] += lin * Math.max(0, dot3(HEAD_FACES[i].n, dir))
      }
    }

    for (let i = 0; i < 6; i++) {
      ctx.faceLevels[i] = sums[i] < 1e-8 ? -Infinity : 20 * Math.log10(sums[i])
    }
  }
}
