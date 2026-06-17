/**
 * deps/ adapter for preview -> shapes-konva. The preview mounts the Konva
 * `ShapesStage` over its composite canvas; it imports it from here per
 * `check:boundaries`. Raw cross-feature imports live in `./shapes-konva-contract`.
 */
export * from './shapes-konva-contract'
