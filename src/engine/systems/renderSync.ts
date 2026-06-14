import { listenerWorld } from './head.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { System } from '../loop/loop.js'
import type { ThreeRenderer } from '../../render/ThreeRenderer.js'
import type { GameWorld } from '../ecs/world.js'

export function createRenderSyncSystem(renderer: ThreeRenderer, gameWorld: GameWorld): System {
  return (ctx: EngineContext, _dt: number) => {
    const ctrl = ctx.input.controls
    const headPos = listenerWorld(ctx)
    const debug = (window as any).__rompiche?.debug ?? {}

    const voices: { x: number; y: number; z: number; level: number; materialId: string }[] = []
    for (const e of gameWorld.with('voice')) {
      const v = e.voice!
      if (v.busy) voices.push({
        x: v.pos.x, y: v.pos.y, z: v.pos.z,
        level: v.gainDb,
        materialId: v.materialId ?? 'unknown',
      })
    }

    renderer.setHeadPosition(headPos)
    renderer.setListening(ctrl.listening)
    renderer.setRain(ctrl.rain, ctrl.density, ctrl.wind)
    renderer.setFieldViz(!!debug.fieldViz, ctx.worldConfig?.l1Field)
    renderer.setDebugVoices(voices, !!debug.debugOn)
    renderer.draw(null as any, 0)
  }
}
