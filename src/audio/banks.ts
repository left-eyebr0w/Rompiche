import { MATERIALS, type MaterialId } from '../engine/components/materials.js'

export type Banks = Record<MaterialId, AudioBuffer[]>

async function decode(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    const arr = await res.arrayBuffer()
    return await ctx.decodeAudioData(arr)
  } catch {
    return null
  }
}

export async function loadBanks(ctx: AudioContext): Promise<Banks> {
  const banks = {} as Banks
  await Promise.all(MATERIALS.map(async (m) => {
    const buffers = (await Promise.all(m.urls.map(u => decode(ctx, u)))).filter(Boolean) as AudioBuffer[]
    banks[m.id] = buffers
  }))
  return banks
}
