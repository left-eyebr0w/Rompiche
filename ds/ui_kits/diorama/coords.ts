/* Shim de reclassement — Grand Refactor J0. Le module vit désormais dans src/.
   La v0 continue d'importer './coords.js' ; ré-export depuis la nouvelle source de vérité. */
export * from '../../../src/engine/context/coords.js'
