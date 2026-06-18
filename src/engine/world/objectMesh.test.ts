/* ── Garde-fou neuf : objets posés → vertices d'impact, fusionnés au pool ─────
   Cœur du chantier « objets posés » (cadrage 04), étendu au filtrage des FACES
   CACHÉES (cadrage 07). On vérifie :
     1) buildObjectVertices ne garde que la face du DESSUS (filtre de normale :
        flancs verticaux + dessous écartés), avec normale réelle, matériau, expoCiel ;
     2) la densité d'échantillonnage suit coords.CELL (grande face → plus de points) ;
     3) l'OCCLUSION marque expoCiel=0 sous un surplomb (objet sous objet, sol sous boîte) ;
     4) impactPoints() fusionne terrain + objets ;
     5) un impact peut tomber sur un vertex d'objet EN HAUTEUR (déterministe, PRNG seedé). */

import { describe, it, expect } from 'vitest'
import { buildObjectVertices } from './objectMesh.js'
import { makeObject } from './objects.js'
import { makeDefaultWorld } from './World.js'
import { makeDefaultTerrain } from './Terrain.js'
import { makeSkyOcclusion } from './skyOcclusion.js'
import { pickImpact } from './terrainMesh.js'
import { makeCoords } from '../context/coords.js'
import { makePrng } from '../context/prng.js'

const coords = makeCoords(25)

describe('buildObjectVertices — filtre de normale (faces cachées, cadrage 07)', () => {
  it('ne garde que la face du DESSUS (flancs verticaux et dessous écartés)', () => {
    /* Boîte plus petite qu'une maille (CELL=0,5) sur chaque côté → 1 point/face. */
    const cube = makeObject({ id: 't', materialId: 'metal', size: [0.4, 0.4, 0.4], position: [0, 0, 0] })
    const verts = buildObjectVertices(cube, coords)
    // Seul le dessus (+Y) passe le seuil de normale → 1 point.
    expect(verts).toHaveLength(1)

    const normales = verts.map(v => `${v.normale.x},${v.normale.y},${v.normale.z}`)
    expect(new Set(normales)).toEqual(new Set(['0,1,0']))
    // Aucun flanc vertical ni dessous.
    expect(normales).not.toContain('0,-1,0')
    expect(normales).not.toContain('1,0,0')
    expect(normales).not.toContain('0,0,1')
  })

  it('porte le matériau de l’objet et expoCiel=1 à ciel ouvert (pas d’occlusion)', () => {
    const cube = makeObject({ id: 't', materialId: 'bache', size: [1, 1, 1], position: [0, 0, 0] })
    const verts = buildObjectVertices(cube, coords)
    expect(verts.every(v => v.matériau === 'bache')).toBe(true)
    expect(verts.every(v => v.expoCiel === 1)).toBe(true)
  })

  it('place les vertices du dessus EN HAUTEUR (à y0 + h/2)', () => {
    const y0 = -5
    const cube = makeObject({ id: 't', materialId: 'terre', size: [2, 2, 2], position: [0, y0, 0] })
    const verts = buildObjectVertices(cube, coords)
    // Le dessus (+Y) est à y0 + h/2 = y0 + 1.
    expect(verts.every(v => v.normale.y === 1)).toBe(true)
    expect(verts.every(v => Math.abs(v.position.y - (y0 + 1)) < 1e-9)).toBe(true)
  })

  it('échantillonne plus densément les grandes faces (densité ≈ coords.CELL)', () => {
    /* Une dalle large 4×0,4×4 : le dessus (4×4) porte (4/CELL)² points. */
    const slab = makeObject({ id: 't', materialId: 'metal', size: [4, 0.4, 4], position: [0, 0, 0] })
    const verts = buildObjectVertices(slab, coords)
    const top = verts.filter(v => v.normale.y === 1)
    const perSide = Math.round(4 / coords.CELL) // 8 à CELL=0,5
    expect(top).toHaveLength(perSide * perSide)
  })
})

describe('occlusion verticale (cadrage 07)', () => {
  const terrain = makeDefaultTerrain({ size: coords.size, cell: coords.CELL, block: coords.BLOCK })

  it('une boîte au-dessus abrite le dessus d’une boîte plus basse (objet sous objet)', () => {
    const bas  = makeObject({ id: 'bas',  materialId: 'metal', size: [2, 1, 2], position: [0, 0, 0] })
    const haut = makeObject({ id: 'haut', materialId: 'metal', size: [2, 1, 2], position: [0, 3, 0] })
    const occ  = makeSkyOcclusion(terrain, coords, [bas, haut])
    const versBas = buildObjectVertices(bas, coords, occ)
    // Le dessus de `bas` (y = 0.5) est sous `haut` (dessous à y = 2.5) → tout abrité.
    expect(versBas.every(v => v.expoCiel === 0)).toBe(true)
    // `haut` reste à ciel ouvert.
    const versHaut = buildObjectVertices(haut, coords, occ)
    expect(versHaut.every(v => v.expoCiel === 1)).toBe(true)
  })

  it('le sol DIRECTEMENT sous une boîte posée n’est plus exposé', () => {
    /* Boîte large surplombant l'origine, son dessous au-dessus du sol. */
    const box = makeObject({ id: 'b', materialId: 'metal', size: [4, 1, 4], position: [0, coords.ground + 3, 0] })
    const occ = makeSkyOcclusion(terrain, coords, [box])
    // Sous la boîte → abrité ; loin de la boîte → exposé.
    expect(occ.isSheltered(0, coords.ground, 0)).toBe(true)
    expect(occ.isSheltered(coords.half - 1, coords.ground, coords.half - 1)).toBe(false)
  })
})

describe('impactPoints() : fusion terrain + objets', () => {
  it('renvoie terrain + Σ faces objets', () => {
    const terrain = makeDefaultTerrain({ size: coords.size, cell: coords.CELL, block: coords.BLOCK })
    const onlyTerrain = makeDefaultWorld({ terrain, coords })
    const nTerrain = onlyTerrain.impactPoints().length

    const obj = makeObject({ id: 't', materialId: 'metal', size: [2, 2, 2], position: [0, 0, 0] })
    const withObj = makeDefaultWorld({ terrain, coords, objects: [obj] })
    const nObjVerts = buildObjectVertices(obj, coords).length

    expect(withObj.impactPoints().length).toBe(nTerrain + nObjVerts)
  })
})

describe('un impact peut tomber sur un objet en hauteur (déterministe)', () => {
  it('avec PRNG seedé, au moins un tirage atteint un vertex d’objet', () => {
    const terrain = makeDefaultTerrain({ size: coords.size, cell: coords.CELL, block: coords.BLOCK })
    /* Objet posé pile sous la tête (au repos), surélevé : forte proba d'être tiré. */
    const head = { x: 0, y: coords.ground + coords.EAR, z: 0 }
    const obj = makeObject({ id: 't', materialId: 'metal', size: [3, 1, 3], position: [0, head.y + 1, 0] })
    const world = makeDefaultWorld({ terrain, coords, objects: [obj] })
    const pool = world.impactPoints() as Parameters<typeof pickImpact>[0]

    const prng = makePrng(7)
    const elevated = obj.position[1] - 0.5 // dessous de l'objet (base)
    let hitObject = false
    for (let i = 0; i < 2000; i++) {
      const p = pickImpact(pool, prng)
      if (p && p.matériau === 'metal' && p.position.y > elevated) { hitObject = true; break }
    }
    expect(hitObject).toBe(true)
  })
})
