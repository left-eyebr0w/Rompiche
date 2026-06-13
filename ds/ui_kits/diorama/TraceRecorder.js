/* ── Boîte noire du diorama — traçage causal exhaustif ───────────────────────
   PAS un enregistrement audio : un journal structuré où chaque son est
   traçable de sa CAUSE (l'impact d'une goutte) à son RENDU (enveloppe,
   position, projection sur les 6 faces de la tête). Conçu pour la
   relecture/débogage hors-ligne — on exporte un fichier, on l'inspecte.

   Principes :
   • Causalité — chaque impact reçoit un id (`impact`) ; tout ce qui en
     découle (décision `trigger`/`reject`, voix `acquire`/`steal`/`release`,
     enveloppe `env`) le référence. On remonte d'un son à sa cause, et
     inversement d'une cause à tous ses effets. Chaque grain a aussi son id
     (`grain`) pour suivre une voix précise dans le temps.
   • Double horloge — `t` = performance.now() (frames/React, ms depuis le
     début), `at` = AudioContext.currentTime (rendu audio, s depuis le début).
     Indispensable pour déboguer les décalages physique↔son.
   • État en delta — position auditeur, gain, vent, mutes… ne sont journalisés
     qu'au CHANGEMENT (événement `state`), avec un numéro de version `sv`.
     Chaque événement porte la version d'état courante : pas de duplication de
     l'état du monde sur chaque goutte, mais l'état est toujours reconstituable.
   • Coût quasi nul — anneau pré-alloué, écriture O(1). L'enregistrement ne doit
     pas perturber ce qu'il mesure ; quand `recording` est faux, `emit` sort
     immédiatement.
   • Export NDJSON — un événement JSON par ligne, lisible et grep-able. Une
     ligne d'en-tête `header` ouvre le fichier (format + méta + troncature). */

export class TraceRecorder {
  constructor({ capacity = 200000 } = {}) {
    this.cap = capacity
    this.buf = new Array(capacity) // anneau pré-alloué
    this.head = 0
    this.count = 0
    this.recording = false
    this.ctx = null
    this.t0 = 0   // performance.now() au démarrage (origine de `t`)
    this.at0 = 0  // AudioContext.currentTime au démarrage (origine de `at`)
    this.seq = 0
    this.stateVersion = 0
    this._impactId = 0
    this._grainId = 0
    this.meta = null
  }

  start(ctx, meta = {}) {
    this.ctx = ctx
    this.head = 0
    this.count = 0
    this.seq = 0
    this.stateVersion = 0
    this._impactId = 0
    this._grainId = 0
    this.t0 = performance.now()
    this.at0 = ctx ? ctx.currentTime : 0
    this.recording = true
    this.meta = {
      startedAt: new Date().toISOString(),
      t0: this.t0,
      at0: this.at0,
      capacity: this.cap,
      ...meta,
    }
    this.emit('session', { event: 'start' })
    return this
  }

  stop() {
    if (!this.recording) return this
    this.emit('session', { event: 'stop' })
    this.recording = false
    return this
  }

  nextImpactId() { return ++this._impactId }
  nextGrainId()  { return ++this._grainId }

  /* Écriture dans l'anneau : O(1), écrase le plus ancien quand plein. Chaque
     événement est horodaté sur les DEUX horloges, relatives au démarrage, et
     estampillé de la version d'état courante (`sv`). */
  emit(type, fields) {
    if (!this.recording) return
    const t = performance.now()
    const at = this.ctx ? this.ctx.currentTime : 0
    const e = {
      seq: ++this.seq,
      t: +(t - this.t0).toFixed(3),
      at: +(at - this.at0).toFixed(6),
      sv: this.stateVersion,
      type,
      ...fields,
    }
    this.buf[this.head] = e
    this.head = (this.head + 1) % this.cap
    if (this.count < this.cap) this.count++
    return e
  }

  /* Delta d'état : incrémente la version puis journalise le patch. Les
     événements suivants référenceront cette version via `sv`. */
  state(patch) {
    if (!this.recording) return this.stateVersion
    this.stateVersion++
    this.emit('state', { patch })
    return this.stateVersion
  }

  /* Événements dans l'ordre chronologique (l'anneau, une fois plein, commence
     au milieu). */
  events() {
    const out = []
    const start = this.count < this.cap ? 0 : this.head
    for (let i = 0; i < this.count; i++) out.push(this.buf[(start + i) % this.cap])
    return out
  }

  toNDJSON() {
    const header = {
      seq: 0,
      type: 'header',
      format: 'rompiche-trace/1',
      meta: this.meta,
      count: this.count,
      truncated: this.count >= this.cap, // anneau plein ⇒ début perdu
    }
    const lines = [JSON.stringify(header)]
    for (const e of this.events()) lines.push(JSON.stringify(e))
    return lines.join('\n') + '\n'
  }

  /* Déclenche le téléchargement du NDJSON dans le navigateur. */
  download(filename) {
    if (typeof document === 'undefined') return null
    const name = filename || `rompiche-trace-${Date.now()}.ndjson`
    const blob = new Blob([this.toNDJSON()], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return name
  }
}
