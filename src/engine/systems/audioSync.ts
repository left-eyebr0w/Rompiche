import { FIXED_DT } from '../loop/loop.js'
import type { Vector3 } from '../context/coords.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { SpatialSource } from '../../audio/SpatialAudioBackend.js'
import type { Banks } from '../../audio/banks.js'

interface ActiveGrain {
  source: AudioBufferSourceNode
  gain: GainNode
}

/* LOOKAHEAD : marge devant l'horloge matérielle pour absorber le jitter rAF/JS. */
const LOOKAHEAD = 0.06
/* Plafond de dérive du playhead devant l'horloge audio. Au-delà, la latence
   « grimpe » (retour de background : la boucle a fait une rafale de ticks bornée
   par MAX_CATCHUP pendant que le temps audio avançait peu). On resynchronise. */
const MAX_DRIFT = LOOKAHEAD + FIXED_DT

/* Résout la tranche audio d'un tick + le playhead suivant, avec DOUBLE garde-fou
   (symétrique) :
     - bas  : playhead en retard sur l'horloge (under-run, stalls JS, 1ᵉʳ tick) → resync ;
     - haut : playhead trop en avance (latence qui grimpe au retour de background ou
              dérive d'horloge) → resync.
   Invariant garanti : t − now ∈ [0.005, MAX_DRIFT]. Pur (testable sans audio). */
export function resolvePlayhead(playhead: number, now: number): { t: number; next: number } {
  let p = playhead
  if (p < now + 0.005) p = now + LOOKAHEAD          // garde-fou bas
  else if (p - now > MAX_DRIFT) p = now + LOOKAHEAD  // garde-fou haut (symétrique)
  return { t: p, next: p + FIXED_DT }
}

export function createAudioSyncSystem(
  world: GameWorld,
  ctx: EngineContext,
  banks: Banks,
  audioCtx: AudioContext,
): System {
  const pool = world.with('voice')
  const headEntities = world.with('listener', 'transform')
  const sources = new Map<number, SpatialSource>()
  const grains = new Map<number, ActiveGrain>()
  /* Un AnalyserNode par voix : mesure le RMS RÉEL du grain (post grain-gain,
     pré-spatialisation), comme la v0 (RainSampler.level). Alimente voice.levelDb. */
  const analysers = new Map<number, AnalyserNode>()
  const measureBuf = new Float32Array(256)

  /* Tête de lecture audio CONTINUE (« A Tale of Two Clocks »). La boucle est
     cadencée par rAF (horloge murale, jitter) mais on programme les grains sur la
     timeline audio matérielle, qu'on fait avancer de FIXED_DT par tick logique.
     Chaque tick possède donc sa tranche de 16,6 ms, indépendante du jitter rAF →
     plus de paquets/trous alignés sur le framerate (la pulsation perçue). */
  let playhead = -1

  function rmsDb(an: AnalyserNode): number {
    an.getFloatTimeDomainData(measureBuf)
    let sq = 0
    for (let i = 0; i < measureBuf.length; i++) sq += measureBuf[i] * measureBuf[i]
    const rms = Math.sqrt(sq / measureBuf.length)
    return rms < 1e-8 ? -Infinity : 20 * Math.log10(rms)
  }

  return () => {
    const backend = ctx.audio
    if (!backend) return

    /* 1) Créer une SpatialSource + un AnalyserNode par voix (paresseux). */
    for (const e of pool) {
      const id = e.voice!.id
      if (!sources.has(id)) {
        const src = backend.createSource()
        sources.set(id, src)
        const an = audioCtx.createAnalyser()
        an.fftSize = 256
        an.smoothingTimeConstant = 0
        an.connect(src.input)
        analysers.set(id, an)
      }
    }

    /* Réserver la tranche audio de ce tick. Le double garde-fou de resolvePlayhead
       resynchronise le playhead s'il prend du retard (under-run) OU s'il dérive trop
       en avance (latence au retour de background) → un seul micro-trou dans ces cas. */
    const { t, next } = resolvePlayhead(playhead, backend.currentTime)
    playhead = next

    /* 2) Démotions : fade-out puis stop (AVANT les onsets, cf. voicePool.ts). */
    for (const d of ctx.frame.demotions) {
      const g = grains.get(d.voice)
      if (!g) continue
      g.gain.gain.cancelScheduledValues(t)
      g.gain.gain.setValueAtTime(g.gain.gain.value, t)
      g.gain.gain.linearRampToValueAtTime(0, t + 0.005)
      g.source.onended = null
      try { g.source.stop(t + 0.005) } catch { /* déjà stoppé */ }
      grains.delete(d.voice)
    }

    /* 3) Onsets : jouer un nouveau grain sur la voix. */
    for (const o of ctx.frame.grainOnsets) {
      let voice = null
      for (const e of pool) {
        if (e.voice!.id === o.voice) { voice = e.voice; break }
      }
      if (!voice || !voice.busy) continue

      const src = sources.get(o.voice)
      if (!src) continue

      const buf = banks[voice.materialId!]?.[voice.sample]
      if (!buf) continue

      src.setMaterial(voice.materialId)

      /* Couper le grain précédent s'il existe encore — avec un fondu de 5 ms
         (comme les démotions), jamais un stop() sec qui claque. */
      const prev = grains.get(o.voice)
      if (prev) {
        prev.gain.gain.cancelScheduledValues(t)
        prev.gain.gain.setValueAtTime(prev.gain.gain.value, t)
        prev.gain.gain.linearRampToValueAtTime(0, t + 0.005)
        prev.source.onended = null
        try { prev.source.stop(t + 0.005) } catch { /* déjà stoppé */ }
        grains.delete(o.voice)
      }

      /* Timbre interpolé L1↔L2 selon mix ∈ [0,1] (cadrage rework/06). lerp des params
         de couche ; pitch en demi-tons → cents, ajouté au détune aléatoire du grain. */
      const tb = ctx.worldConfig.timbre
      const mix = Math.min(1, Math.max(0, voice.mix ?? 0))
      const lerp = (a: number, b: number) => a + (b - a) * mix
      const lowpassHz = lerp(tb.lowpassHzL1, tb.lowpassHzL2)
      const pitchCents = lerp(tb.pitchL1, tb.pitchL2) * 100
      const wet = lerp(tb.diffusionL1, tb.diffusionL2)

      const grainSrc = audioCtx.createBufferSource()
      grainSrc.buffer = buf
      grainSrc.detune.value = voice.grain + pitchCents

      /* Étalement sous-tick : jouer le grain à son instant Poisson dans la fenêtre
         du tick, pas à l'instant du tick. Sans ça, toutes les gouttes d'un tick
         démarrent ensemble → pulsation à la fréquence de tick (60 Hz). */
      const at = t + (o.offset ?? 0)

      const grainGain = audioCtx.createGain()
      /* Fondu d'entrée de ~4 ms : un grain qui passe de 0 à plein volume
         instantanément produit un clic. Multiplié par des dizaines de gouttes/s,
         c'est la saccade perçue.
         Le palier tient compte du rainGainDb (défaut 0 dB = gain 1). */
      /* Gain de couche (solo/mute, cf. cadrage 05 §Instrument) : L1 et voix L2 passent
         par ce palier de grain. Les voix L2 portent layer==='L2', sinon L1 (héros). */
      const layerLin = ctx.layerGain?.[voice.layer === 'L2' ? 'L2' : 'L1'] ?? 1
      const rainLin = Math.pow(10, (ctx.rainGainDb ?? 0) / 20) * layerLin
      grainGain.gain.setValueAtTime(0, at)
      grainGain.gain.linearRampToValueAtTime(rainLin, at + (ctx.worldConfig.grain.attaqueS ?? 0.004))

      /* Flou = passe-bas par grain (coupe interpolée selon mix) inséré avant le gain. */
      const lp = audioCtx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = lowpassHz

      const an = analysers.get(o.voice)
      grainSrc.connect(lp).connect(grainGain).connect(an ?? src.input)

      /* Diffusion (halo) : send wet ∝ mix vers le bus de délais partagé du backend. */
      if (wet > 0 && backend.diffusionInput) {
        const sendGain = audioCtx.createGain()
        sendGain.gain.value = rainLin * wet
        grainGain.connect(sendGain).connect(backend.diffusionInput)
      }

      grainSrc.start(at)

      const vid = o.voice
      grainSrc.onended = () => {
        if (grains.get(vid)?.source === grainSrc) {
          grains.delete(vid)
        }
      }

      grains.set(vid, { source: grainSrc, gain: grainGain })
    }

    /* 4) Positionner les sources + mesurer le niveau RÉEL de chaque voix. */
    for (const e of pool) {
      const v = e.voice!
      if (!v.busy) { v.levelDb = -Infinity; continue }
      const src = sources.get(v.id)
      if (src) src.setPosition(v.pos)
      const an = analysers.get(v.id)
      v.levelDb = an ? rmsDb(an) : -Infinity
    }

    /* 5) Positionner l'auditeur (depuis l'entité tête ECS, mise à jour par InputSystem). */
    let headPos: Vector3 = { x: 0, y: 0, z: 0 }
    for (const e of headEntities) { headPos = e.transform!.position; break }
    backend.setListener(headPos, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 })

    /* 6) Appliquer le gain master (relatif au gain de base du backend). */
    backend.setMasterGainDb(ctx.masterGainDb ?? 0)

    /* 7) Réseau de délais de diffusion (réglable live via le HUD). */
    backend.setDiffusion(ctx.worldConfig.timbre.delayS, ctx.worldConfig.timbre.feedback)
  }
}
