(feature/requirement) GROUND MODEL MUST SUPPORT NON-FLAT TERRAIN — SimCity-as-much-as-GTA.

PRIORITY: BASE-LEVEL, ACCOUNT NOW (maintainer, not deferred). Terrain is a FOUNDATIONAL part of world-gen, built into the base of the stack now — NOT a later phase. Terrain is never completely flat.

MARBLE-MADNESS PRIOR ART (wordslide-codex/client/src/games/marble-madness/world/TerrainMeshBuilder.ts): terrain is QUANTIZED into discrete HEIGHT_LEVELS (quantizeHeight(normalized, HEIGHT_LEVELS) * LEVEL_HEIGHT) — STEPPED/TERRACED, not smooth (the SimCity model). This makes flat-blocks-on-hills natural: each terrace is flat (a block sits on a level), the steps between levels are the slopes/retaining. Uses a WASM noise kernel (sampleLayersQuantizedHeightmap), a HeightSampler seam (heightAt(x,z)), generateHeightmapMesh -> positions+normals, and terrain-rendering tricks (normal flipping etc. — study generateHeightmapMesh + the grid/solid shaders). Reuse: quantized height levels + heightSampler seam + heightmap mesh gen + normal handling.


DESIGN REFRAME: think of HOD as much a SimCity clone as a GTA clone. The world is terrain-aware: a hilly deterministic heightfield with city blocks/zones graded onto it, SimCity-style (terrain + zoning/land-use + graded lots + terrain-following roads), NOT a flat grid.

The Rust ground/surface model (HOD-T107 surface.rs/chunk.rs/rustGround.ts) currently assumes 100% flat: street y=0, block platforms at a fixed CURB_HEIGHT. It must instead sit on a deterministic TERRAIN HEIGHTFIELD — y sampled from terrain(x,z) (pure fn of seed,x,z; same determinism contract). flat today == terrain≡0, so it extends the stack, not a rewrite.

CONCRETE VISION (maintainer):
- FLAT city blocks built ON hills — each block is CUT-AND-FILLED to a flat pad at a base height (terrain at block centre), with RETAINING edges where the flat pad meets the surrounding slope (variable-height curb/retaining wall, stepped sidewalks). The block is flat; the land under/around it is not.
- Buildings SUNKEN into the hillside — a building on a graded pad has its foundation BURIED on the uphill side and EXPOSED on the downhill side (real hillside lots). Building base treatment must account for the cut.
- Streets/sidewalks FOLLOW the terrain slope between blocks (graded road profiles); curb heights vary along the grade.

GENERATION BASIS (the primitive — start here, not as a post-process): every footprint needs a FLAT FOUNDATION at a chosen pad height, and on sloped terrain that foundation is reconciled to the ground ONE WAY OR ANOTHER:
  - CUT — dig a flat foundation into the high side (terrain above pad → excavate; building/retaining buried there), and/or
  - FILL — a slab/plinth that extends partway ABOVE ground on the low side (terrain below pad → exposed foundation wall/slab).
Generation chooses the pad height per footprint (e.g. balance cut vs fill / minimize earthwork, like real grading), then the visible base = buried uphill (cut) + exposed plinth downhill (fill). This single cut/fill-to-a-flat-pad primitive applies to EVERY flat element — building lots, block pads, parking, sidewalks — and is the basis the programmatic generator must assume from the start. The data model carries per-footprint pad height + cut depth / fill height so the building-base mesh and retaining/curb geometry derive from it.

DOWNSTREAM (holistic): collision (cars/peds ride terrain height), camera, spawn, building-base meshing, parking/park surfaces — all read the heightfield.

PRIOR ART: R050 already passes `elevation` to classify; rivers-bridges.md has elevation/SDF fields. Reference SimCity terrain+zoning+lot-grading as the model.

Inception-out: governed by HOD-D003/D015 (Rust world-gen, data-model-first), links HOD-T107. Likely its own sub-epic (terrain heightfield layer + grading + building-cut). Project: HOD.
