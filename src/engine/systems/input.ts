import { headInputToWorld } from '../context/coords.js'
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
  const headEntities = world.with('listener', 'transform')

  return () => {
    /* Draine toutes les commandes SAUF `edit` : celles-ci sont consommées par
       EditSystem (qui tourne juste après), pour garder la boucle d'édition isolée
       de l'entrée générale (cadrage 07). Les autres sont retirées de la file ici. */
    const cmds: typeof ctx.input.commands = []
    const kept: typeof ctx.input.commands = []
    for (const cmd of ctx.input.commands) (cmd.t === 'edit' ? kept : cmds).push(cmd)
    ctx.input.commands.length = 0
    ctx.input.commands.push(...kept)
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
        case 'setScale':
          break
      }
    }

    const ctrl = ctx.input.controls

    // Mettre à jour la position monde de la tête (entité ECS + cache ctx pour systèmes sans world).
    const worldPos = headInputToWorld(ctrl.listener, ctx.coords)
    ctx.headWorldPos = worldPos
    for (const e of headEntities) {
      e.transform!.position = worldPos
      e.listener!.offset = { ...ctrl.listener }
      break
    }

    for (const ent of emitterEntities) {
      if (ent.rainEmitter) {
        ent.rainEmitter.density = ctrl.density
        ent.rainEmitter.active = ctrl.rain
      }
      break
    }

    ctx.rainGainDb = ctrl.rainGainDb
    ctx.masterGainDb = ctrl.masterGainDb

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
