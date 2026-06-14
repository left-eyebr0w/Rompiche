import { describe, it, expect } from 'vitest'

function computeCameraPosition(size: number, spinDeg: number, zoom: number): { x: number; y: number; z: number } {
  const spinRad = spinDeg * Math.PI / 180
  const tiltRad = 22.5 * Math.PI / 180
  const dist = size * 2.1 / zoom
  return {
    x: dist * Math.sin(spinRad) * Math.cos(tiltRad),
    y: dist * Math.sin(tiltRad),
    z: dist * Math.cos(spinRad) * Math.cos(tiltRad),
  }
}

describe('computeCameraPosition', () => {
  it('place la caméra sur +Z à spin=0', () => {
    const cam = computeCameraPosition(25, 0, 1)
    expect(cam.x).toBeCloseTo(0, 6)
    expect(cam.y).toBeGreaterThan(0)
    expect(cam.z).toBeGreaterThan(0)
  })

  it('déplace la caméra sur +X à spin=90°', () => {
    const cam = computeCameraPosition(25, 90, 1)
    expect(cam.x).toBeGreaterThan(0)
    expect(cam.z).toBeCloseTo(0, 4)
  })

  it('spin=180° place la caméra sur -Z', () => {
    const cam = computeCameraPosition(25, 180, 1)
    expect(cam.x).toBeCloseTo(0, 4)
    expect(cam.z).toBeLessThan(0)
  })

  it('zoom > 1 rapproche la caméra', () => {
    const cam1 = computeCameraPosition(25, 45, 1)
    const cam2 = computeCameraPosition(25, 45, 2)
    expect(Math.hypot(cam2.x, cam2.y, cam2.z)).toBeLessThan(Math.hypot(cam1.x, cam1.y, cam1.z))
  })

  it('distance est cohérente avec size*2.1/zoom', () => {
    const cam = computeCameraPosition(25, 0, 1)
    const dist = Math.sqrt(cam.x * cam.x + cam.y * cam.y + cam.z * cam.z)
    expect(dist).toBeCloseTo(25 * 2.1, 4)
  })
})
