/* Shim de reclassement — Grand Refactor J1. Le PRNG (Resource déterministe) vit
   désormais dans src/. La v0 continue d'importer './prng.js' ; ré-export depuis la
   nouvelle source de vérité. */
export * from '../../../src/engine/context/prng.js'
