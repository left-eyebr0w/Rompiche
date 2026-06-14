/* ── RenderTarget — couture rendu ─ Grand Refactor J0 ─────────────────────────
   Type-frontière SEUL (architecture.md §4.3). Le moteur ne connaît pas three.js ;
   il pousse l'état vers un RenderTarget. Impl ThreeRenderer (wireframe v1). Découple
   aussi pour d'éventuels tests headless.
     - draw() reçoit le monde + alpha d'interpolation (accumulator / FIXED_DT). */

import type { Entity } from '../engine/ecs/Entity.js'

/** Vue minimale du monde lue par le rendu (itérable d'entités). */
export type RenderWorld = Iterable<Entity>

export interface RenderTarget {
  /** Met à jour la scène depuis l'état moteur. alpha ∈ [0,1] = interpolation visuelle. */
  draw(world: RenderWorld, alpha: number): void
  /** Libère les ressources GPU. */
  dispose(): void
}
