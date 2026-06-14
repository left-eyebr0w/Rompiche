import type { EngineContext } from '../engine/context/EngineContext.js'
import type { GameWorld } from '../engine/ecs/world.js'
import type { EngineSnapshot } from './EngineSnapshot.js'
import type { Command, ControlState } from '../shared/commands.js'

type Listener = () => void

export interface EngineStore {
  getSnapshot(): EngineSnapshot
  subscribe(cb: Listener): () => void
  pushCommand(cmd: Command): void
  /** Écriture directe dans ctx.input.controls (muable). */
  controls: ControlState
  /** Arrête la boucle de polling RAF. */
  stop(): void
}

export function createEngineStore(
  ctx: EngineContext,
  world: GameWorld,
  getMasterLevel: () => number,
): EngineStore {
  const listeners = new Set<Listener>()
  let lastTick = -1
  let frameCount = 0
  let rafId = 0
  let _running = true
  let snapshot: EngineSnapshot = takeSnapshot()

  function takeSnapshot(): EngineSnapshot {
    const voices = world.with('voice')
    let busy = 0
    let size = 0
    let steals = 0

    const matCounts: Record<string, { count: number; gainSum: number }> = {}

    for (const e of voices) {
      const v = e.voice!
      size++
      if (v.busy) {
        busy++
        const matId = v.materialId ?? 'unknown'
        if (!matCounts[matId]) matCounts[matId] = { count: 0, gainSum: 0 }
        matCounts[matId].count++
        matCounts[matId].gainSum += isFinite(v.levelDb) ? Math.pow(10, v.levelDb / 20) : 0
      }
    }

    const materials = Object.entries(matCounts).map(([id, d]) => {
      const avgLin = d.count > 0 ? d.gainSum / d.count : 0
      const level = avgLin > 1e-9 ? 20 * Math.log10(avgLin) : -Infinity
      return {
        id,
        label: id,
        level,
        rate: 0,
        triggerCount: d.count,
      }
    })

    const lastTickCount = ctx.time.tick
    if (lastTickCount > lastTick) {
      steals = ctx.frame.demotions.length
      lastTick = lastTickCount
    }

    const linMaster = getMasterLevel()
    return {
      ready: !!ctx.audio,
      master: linMaster > 1e-9 ? 20 * Math.log10(linMaster) : -Infinity,
      pool: { busy, size, steals },
      materials,
      faceLevels: [...ctx.faceLevels] as [number, number, number, number, number, number],
    }
  }

  function updateSnapshot(): void {
    snapshot = takeSnapshot()
    for (const cb of listeners) cb()
  }

  function poll(): void {
    if (!_running) return
    rafId = requestAnimationFrame(poll)
    if (++frameCount % 6 === 0) updateSnapshot()
  }

  function startPoll(): void {
    if (rafId) return
    rafId = requestAnimationFrame(poll)
  }

  function stopPoll(): void {
    _running = false
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (cb: Listener) => {
      listeners.add(cb)
      if (listeners.size === 1) startPoll()
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0) stopPoll()
      }
    },
    pushCommand: (cmd: Command) => {
      ctx.input.commands.push(cmd)
    },
    get controls(): ControlState {
      return ctx.input.controls
    },
    stop: stopPoll,
  }
}
