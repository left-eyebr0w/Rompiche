import { describe, it, expect, vi } from 'vitest'
import { WebAudioBackend } from './WebAudioBackend.js'

/* Mock minimal AudioContext (env node, pas de Web Audio natif). */
function makeAudioCtxMock() {
  const makeParam = () => ({ value: 0 })
  const makeNode = () => ({ connect: vi.fn().mockReturnThis(), disconnect: vi.fn() })
  return {
    currentTime: 42,
    sampleRate: 48000,
    destination: makeNode(),
    listener: {
      positionX: makeParam(), positionY: makeParam(), positionZ: makeParam(),
      forwardX:  makeParam(), forwardY:  makeParam(), forwardZ:  makeParam(),
      upX:       makeParam(), upY:       makeParam(), upZ:       makeParam(),
    },
    createGain: vi.fn(() => ({ ...makeNode(), gain: makeParam() })),
    createPanner: vi.fn(() => ({
      ...makeNode(),
      panningModel: '', distanceModel: '',
      refDistance: 1, maxDistance: 10000, rolloffFactor: 1,
      positionX: makeParam(), positionY: makeParam(), positionZ: makeParam(),
    })),
    createBiquadFilter: vi.fn(() => ({ ...makeNode(), type: '', frequency: makeParam() })),
    createConvolver: vi.fn(() => makeNode()),
  }
}

describe('WebAudioBackend', () => {
  it('init : masterGain.gain = 3 et connecté à destination', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    expect(backend.masterGain).toBeTruthy()
    expect(backend.masterGain!.gain.value).toBe(3)
    expect(backend.masterGain!.connect).toHaveBeenCalled()
  })

  it('currentTime délègue à AudioContext', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    expect(backend.currentTime).toBe(42)
  })

  it('createSource retourne un input connectable', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    const src = backend.createSource()
    expect(src.input).toBeTruthy()
    expect(typeof (src.input as any).connect).toBe('function')
  })

  it('createSource : PannerNode est HRTF + inverse', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    backend.createSource()
    const panner = ctx.createPanner.mock.results[0].value
    expect(panner.panningModel).toBe('HRTF')
    expect(panner.distanceModel).toBe('inverse')
  })

  it('setPosition pousse dans les AudioParams du PannerNode', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    const src = backend.createSource()
    src.setPosition({ x: 1, y: 2, z: 3 })
    const panner = ctx.createPanner.mock.results[0].value
    expect(panner.positionX.value).toBe(1)
    expect(panner.positionY.value).toBe(2)
    expect(panner.positionZ.value).toBe(3)
  })

  it('setMaterial ajuste refDistance et maxDistance selon le matériau', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    const src = backend.createSource()
    src.setMaterial('metal')
    const panner = ctx.createPanner.mock.results[0].value
    // metal : minDistance=0.5, maxDistance=14 (cf. materials.ts)
    expect(panner.refDistance).toBe(0.5)
    expect(panner.maxDistance).toBe(14)
  })

  it('setMaterial(null) remet les valeurs par défaut', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    const src = backend.createSource()
    src.setMaterial('metal')
    src.setMaterial(null)
    const panner = ctx.createPanner.mock.results[0].value
    expect(panner.refDistance).toBe(0.5)
    expect(panner.maxDistance).toBe(14)
  })

  it('setListener pousse pos + forward + up dans AudioListener', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    backend.setListener({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 })
    expect(ctx.listener.positionX.value).toBe(1)
    expect(ctx.listener.positionY.value).toBe(2)
    expect(ctx.listener.positionZ.value).toBe(3)
    expect(ctx.listener.forwardZ.value).toBe(-1)
    expect(ctx.listener.upY.value).toBe(1)
  })

  it('dispose déconnecte la source', () => {
    const backend = new WebAudioBackend()
    const ctx = makeAudioCtxMock() as any
    backend.init(ctx)
    const src = backend.createSource()
    src.dispose()
    const filter = ctx.createBiquadFilter.mock.results[0].value
    const panner = ctx.createPanner.mock.results[0].value
    expect(filter.disconnect).toHaveBeenCalled()
    expect(panner.disconnect).toHaveBeenCalled()
  })
})
