import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { DioramaStatePatch } from '../../shared/state.js'

export interface InputSystemDeps {
  world: GameWorld
  audioCtx?: AudioContext
  onSave?: (name: string) => void
  onLoad?: (name: string, patch: DioramaStatePatch) => void
  onReset?: () => void
}

export function createInputSystem(ctx: EngineContext, deps: InputSystemDeps): System {
  const { world, audioCtx, onSave, onLoad, onReset } = deps

  let prevListening = ctx.input.controls.listening
  const emitterEntities = world.with('rainEmitter')

  return () => {
    const cmds = ctx.input.commands.splice(0)
    for (const cmd of cmds) {
      switch (cmd.t) {
        case 'save':
          onSave?.(cmd.name)
          break
        case 'load':
          onLoad?.(cmd.name, {})
          break
        case 'reset':
          onReset?.()
          break
        case 'paint':
        case 'setScale':
          break
      }
    }

    const ctrl = ctx.input.controls

    ctx.surfaces.metal = ctrl.metal ? 1 : 0
    ctx.surfaces.bache = ctrl.bache ? 1 : 0

    for (const ent of emitterEntities) {
      if (ent.rainEmitter) {
        ent.rainEmitter.density = ctrl.density
        ent.rainEmitter.active = ctrl.rain
      }
      break
    }

    if (audioCtx) {
      const nowListening = ctrl.listening
      if (nowListening !== prevListening) {
        if (nowListening) {
          audioCtx.resume()
        } else {
          audioCtx.suspend()
        }
        prevListening = nowListening
      }
    }
  }
}
