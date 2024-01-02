// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

// These settings are designed to render 10K small shapes, regardless of if
// they are distributed evenly across the screen, or if they are all stacked on
// each other.

export const SCREEN_WIDTH_PX      = 1792   // 1146880 total pixels
export const SCREEN_HEIGHT_PX     = 640

export const TILE_SIZE_X          = 16     // pixels
export const TILE_SIZE_Y          = 16
export const TILE_SIZE_TOTAL      = 256
export const NUM_TILES_X          = 112
export const NUM_TILES_Y          = 40
export const NUM_TILES_TOTAL      = 4480

export const MAX_ROUGH_SHAPES     = 10000
export const MAX_FINE_SHAPES      = 10000   // 160KB to hold every fine shape
export const MAX_FINE_POINTERS    = MAX_ROUGH_SHAPES * 4  // can hold all tile overlaps

export const UNIFORM_BUFFER_SIZE  = 8000
export const MISC_BUFFER_SIZE     = 4096 + (20480) + (36864) + (MAX_FINE_POINTERS*4)
export const ROUGH_BUFFER_SIZE    = MAX_ROUGH_SHAPES * 48  // 480KB
export const FINE_BUFFER_SIZE     = MAX_FINE_SHAPES * 32   // 320KB
export const TEXTURE_BUFFER_SIZE  = SCREEN_WIDTH_PX * SCREEN_HEIGHT_PX * 16  // 18MB

export const WG_ROUGH_WORKLOAD    = 128  // Rough shapes processed per WG
export const WG_BIN_WORKLOAD      = 128  // Fine shapes processed per WG
export const WG_BIN2_WORKLOAD     = 32

export const DEBUG_SHOW_ACTIVE_TILES = 0x01

export const WGSL_INCLUDE = `

////////////////////////////////////////////////////////////
// IMPORTANT: These settings must match the javascript code!
const SCREEN_WIDTH_PX     = ${SCREEN_WIDTH_PX};
const SCREEN_HEIGHT_PX    = ${SCREEN_HEIGHT_PX};
const TILE_SIZE_X         = ${TILE_SIZE_X};
const TILE_SIZE_Y         = ${TILE_SIZE_Y};
const NUM_TILES_X         = ${NUM_TILES_X};
const NUM_TILES_Y         = ${NUM_TILES_Y};
const MAX_FINE_POINTERS   = ${MAX_FINE_POINTERS};
const WG_ROUGH_WORKLOAD   = ${WG_ROUGH_WORKLOAD};
const WG_BIN_WORKLOAD     = ${WG_BIN_WORKLOAD};
const WG_BIN2_WORKLOAD    = ${WG_BIN2_WORKLOAD};

const DEBUG_SHOW_ACTIVE_TILES = ${DEBUG_SHOW_ACTIVE_TILES};
////////////////////////////////////////////////////////////


struct UniformData {
    current_time: f32,
    debug_flags: u32,
    num_rough_shapes: i32,
    // todo: noise data
};

struct MiscData {
    // This is calculated during rough shape processing, when appending to fine buffer
    num_fine_shapes: atomic<i32>,

    // This allocates memory during bin step 2
    num_fine_pointers: atomic<i32>,

    // This is calculated during binning step 1, and can be read by the GUI
    @align(4096) num_shapes_per_tile: array<array<atomic<i32>, NUM_TILES_X>, NUM_TILES_Y>,

    // This populated during binning step 2
    // It is read by the fine rasterizer
    @align(4096) tile_shape_index: array<array<FineIndex, NUM_TILES_X>, NUM_TILES_Y>,

    @align(4096) tile_shape_pointers: array<i32, MAX_FINE_POINTERS>,
};


struct MiscDataRead {
    num_fine_shapes: i32,
    num_fine_pointers: i32,
    @align(4096) num_shapes_per_tile: array<array<i32, NUM_TILES_X>, NUM_TILES_Y>,
    @align(4096) tile_shape_index: array<array<FineIndex, NUM_TILES_X>, NUM_TILES_Y>,
    @align(4096) tile_shape_pointers: array<i32, MAX_FINE_POINTERS>,
};



struct FineIndex {
    offset: i32,
    length: i32,
};


// A basic particle.
struct RoughShape {
    world_position: vec2<f32>,
    world_velocity: vec2<f32>,

    world_size:    f32,
    start_time:    f32,
    duration_secs: f32,
    flags:         u32,

    color:         vec4<f32>,
};


struct FineShape {
    view_position: vec2<f32>,
    view_size_x: f32,
    color: vec3<f32>,
};

fn get_texture_linear_index(view_x: f32, view_y: f32) -> i32
{
    return i32(floor(view_x) + floor(view_y) * SCREEN_WIDTH_PX);
}

`;
