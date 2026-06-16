/* ── Worklet-horloge (maître d'horloge du moteur) ─ architecture.md §2 ─────────
   Ne produit AUCUN son. Émet un tick régulier depuis le thread audio, qui — lui —
   n'est jamais throttlé quand l'onglet perd le focus / l'écran s'éteint
   (contrairement à requestAnimationFrame, totalement mis en pause à ce moment).
   À chaque tick, le thread principal fait avancer la boucle à pas fixe : la
   simulation (et donc l'audio) continue masquée. C'est ce qui rend le mode
   background possible (audio seul, sans rendu).

   process() est appelé par le moteur audio toutes les 128 frames (~2,7 ms à
   48 kHz) ; on accumule jusqu'à `intervalMs` (≈ 16 ms, ex-cadence rAF) avant de
   poster, pour ne pas noyer le thread principal de messages.

   Le nœud doit rester branché dans le graphe pour être « pull »é : WorkletClock le
   connecte via un gain à 0 (sa sortie silencieuse n'atteint jamais les haut-parleurs).
   Récupéré verbatim du clock-processor v0 (éprouvé en production). */
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
         affamerait la simulation. currentTime préserve le temps réellement écoulé. */
      this.port.postMessage(currentTime)
    }
    return true
  }
}

registerProcessor('clock-processor', ClockProcessor)
