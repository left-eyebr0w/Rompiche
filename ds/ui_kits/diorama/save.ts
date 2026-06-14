/* Shim de reclassement — Grand Refactor J0. Le module vit désormais dans src/.
   La v0 continue d'importer './save.js' ; ré-export depuis la nouvelle source de vérité. */
export * from '../../../src/persistence/save.js'
