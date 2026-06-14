/* ── Worklet-horloge (cadence L1) ─────────────────────────────────────────────
   Ne produit AUCUN son. Émet un tick régulier depuis le thread audio, qui — lui —
   n'est jamais throttlé quand l'onglet perd le focus (contrairement à
   requestAnimationFrame, totalement mis en pause à ce moment). À chaque tick le
   thread principal exécute le Poisson L1 : la pluie continue de sonner masquée,
   comme L2/L3 (worklets persistants), sans toucher au chemin de voix HRTF.

   process() est appelé par le moteur audio toutes les 128 frames (~2,7 ms à
   48 kHz) ; on accumule jusqu'à `intervalMs` (≈ 16 ms, ex-cadence rAF) avant de
   poster, pour ne pas noyer le thread principal de messages.

   Le nœud doit rester branché dans le graphe pour être « pull »é : RainSampler le
   connecte via un gain à 0 (sa sortie silencieuse n'atteint jamais les haut-parleurs). */
class ClockProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options)
    const intervalMs = options?.processorOptions?.intervalMs ?? 16
    this._period = Math.max(1, Math.round(sampleRate * intervalMs / 1000)) // en frames
    this._acc = 0
  }

  process(_inputs, outputs) {
    const out = outputs[0]
    const len = out?.[0]?.length ?? 128
    if (out) for (let c = 0; c < out.length; c++) out[c].fill(0) // sortie muette
    this._acc += len
    if (this._acc >= this._period) {
      this._acc = 0
      /* On transporte l'horloge AUDIO (currentTime, en secondes), pas un simple
         signal : si le thread principal stalle (React/WebGL) et délivre les
         messages en rafale, performance.now() compresserait les dt à ~0 et
         affamerait le Poisson. currentTime préserve le temps réellement écoulé. */
      this.port.postMessage(currentTime)
    }
    return true
  }
}

registerProcessor('clock-processor', ClockProcessor)
