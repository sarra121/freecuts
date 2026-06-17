/**
 * deps/ adapter for the shapes-konva feature.
 *
 * The editor reads/writes the shape-edit preview store (live property previews
 * from the properties panel, vertex/body drag previews from the canvas
 * transformers), commits shape edits, resolves keyframes, and drives the draw
 * tool. Per the feature-boundary rule (`check:boundaries`) editor modules import
 * these from here; per `check:deps-contracts` the raw cross-feature imports live
 * in `./shapes-konva-contract`. If shapes-konva changes its internal layout, only
 * the contract file needs updating.
 */
export * from './shapes-konva-contract'
