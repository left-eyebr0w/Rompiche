/* Shim de reclassement — Grand Refactor J0. Le module vit désormais dans src/.
   La v0 continue d'importer './objects.js' ; ré-export depuis la nouvelle source de vérité. */
export * from '../../../src/engine/world/objects.js'
