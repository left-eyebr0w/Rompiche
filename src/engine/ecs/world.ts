/* ── Le World ECS (Miniplex) ─ Grand Refactor J1 ─────────────────────────────
   Conteneur d'entités Miniplex (architecture.md §3). On n'utilise PAS @miniplex/react
   (R3F abandonné) : juste le World nu + ses queries (archetypes). Les systèmes sont
   de simples fonctions qui itèrent des queries dérivées de ce World.

   À J1 le World existe et tourne à vide ; il se peuplera aux jalons suivants
   (RainEmitter/Listener/Voice…, puis monde vivant). */

import { World } from 'miniplex'
import type { Entity } from './Entity.js'

/** Le type du World du jeu, paramétré par notre Entity. */
export type GameWorld = World<Entity>

/** Crée un World ECS vide. Un seul par moteur. */
export function createWorld(): GameWorld {
  return new World<Entity>()
}
