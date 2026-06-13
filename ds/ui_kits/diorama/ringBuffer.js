/* ── Ring buffer SPSC (Single Producer Single Consumer) ──────────────────────
   Non bloquant, pré-alloué. Utilise SharedArrayBuffer si dispo (COOP/COEP),
   sinon fallback Array circulaire (même thread ou postMessage par lots de 64).
   Ordres encodés en champs numériques : { type, at, a0..a7 }.
   Producteur : push(ordre) → false si plein (jamais bloquant).
   Consommateur : pop() → ordre | null, peekAt() → at de la tête. */

/* Types d'ordres (uint8) */
export const ORD = {
  PLAY_IMPACT:  1,
  SET_SECTOR:   2,
  SET_BED:      3,
  SET_LISTENER: 4,
  SET_SCALE:    5,
}

/* Taille d'un slot : type(1) + at(1) + 8 args = 10 Float64 */
const SLOT_FIELDS = 10

export function makeRing(capacity = 1024) {
  /* Tentative SharedArrayBuffer (headers COOP/COEP requis) */
  let sab = null
  try {
    sab = new SharedArrayBuffer(4 * 2 + capacity * SLOT_FIELDS * 8) // head+tail en Int32 + données
  } catch {
    sab = null
  }

  if (sab) {
    return _makeSABRing(sab, capacity)
  } else {
    return _makeArrayRing(capacity)
  }
}

/* ── Implémentation SharedArrayBuffer ── */
function _makeSABRing(sab, capacity) {
  const ctrl = new Int32Array(sab, 0, 2)      // [head, tail]
  const data  = new Float64Array(sab, 8, capacity * SLOT_FIELDS)
  let _usingSAB = true

  function push(o) {
    const tail = Atomics.load(ctrl, 1)
    const next = (tail + 1) % capacity
    if (next === Atomics.load(ctrl, 0)) return false // plein
    const base = tail * SLOT_FIELDS
    data[base + 0] = o.type ?? 0
    data[base + 1] = o.at   ?? 0
    const args = o.args ?? []
    for (let i = 0; i < 8; i++) data[base + 2 + i] = args[i] ?? 0
    Atomics.store(ctrl, 1, next)
    return true
  }

  function pop() {
    const head = Atomics.load(ctrl, 0)
    if (head === Atomics.load(ctrl, 1)) return null
    const base = head * SLOT_FIELDS
    const o = {
      type: data[base],
      at:   data[base + 1],
      args: Array.from(data.subarray(base + 2, base + 10)),
    }
    Atomics.store(ctrl, 0, (head + 1) % capacity)
    return o
  }

  function peekAt() {
    const head = Atomics.load(ctrl, 0)
    if (head === Atomics.load(ctrl, 1)) return Infinity
    return data[head * SLOT_FIELDS + 1]
  }

  function drain(tMax) {
    const out = []
    while (peekAt() <= tMax) { const o = pop(); if (o) out.push(o) }
    return out
  }

  return { push, pop, peekAt, drain, usingSAB: true }
}

/* ── Fallback Array circulaire (même thread ou SAB indisponible) ── */
function _makeArrayRing(capacity) {
  const buf = new Array(capacity).fill(null)
  let head = 0, tail = 0

  function push(o) {
    const next = (tail + 1) % capacity
    if (next === head) return false
    buf[tail] = o
    tail = next
    return true
  }

  function pop() {
    if (head === tail) return null
    const o = buf[head]
    buf[head] = null
    head = (head + 1) % capacity
    return o
  }

  function peekAt() {
    if (head === tail) return Infinity
    return buf[head]?.at ?? Infinity
  }

  function drain(tMax) {
    const out = []
    while (peekAt() <= tMax) { const o = pop(); if (o) out.push(o) }
    return out
  }

  return { push, pop, peekAt, drain, usingSAB: false }
}
