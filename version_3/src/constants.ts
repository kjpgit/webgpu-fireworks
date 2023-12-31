// webgpu-fireworks Copyright (C) 2023 Karl Pickett
// All rights reserved

// These settings are designed to render ~1 million small shapes, regardless of
// if they are distributed evenly across the screen, or if they are all stacked
// on each other.

export const MAX_ROUGH_SHAPES     = 100000
export const MAX_FINE_SHAPES      = 1000000

export const WG_RASTER_PIXELS_X  = 16
export const WG_RASTER_PIXELS_Y  = 16

//export const SCREEN_WIDTH_PX = 1920
//export const SCREEN_HEIGHT_PX = 1080
export const SCREEN_WIDTH_PX =  1792
export const SCREEN_HEIGHT_PX = 640

export const UNIFORM_BUFFER_SIZE  = 8000
export const ROUGH_BUFFER_SIZE    = MAX_ROUGH_SHAPES * 48  // == 4,800,000
export const FINE_BUFFER_SIZE     = MAX_FINE_SHAPES * 16   // == 16,000,000
export const TEXTURE_BUFFER_SIZE  = SCREEN_WIDTH_PX * SCREEN_HEIGHT_PX * 16  // == 32MB!
export const MISC_BUFFER_SIZE     = 64000

export const WG_ROUGH_THREADS     = 128
export const WG_BIN_CHUNK_LEN     = 4000

export const WGSL_INCLUDE = `

////////////////////////////////////////////////////////////
// IMPORTANT: These settings must match the javascript code!
const SCREEN_WIDTH_PX = ${SCREEN_WIDTH_PX};
const SCREEN_HEIGHT_PX = ${SCREEN_HEIGHT_PX};
const WG_RASTER_PIXELS_X = ${WG_RASTER_PIXELS_X};
const WG_RASTER_PIXELS_Y = ${WG_RASTER_PIXELS_Y};
const WG_ROUGH_THREADS   = ${WG_ROUGH_THREADS};
const WG_BIN_CHUNK_LEN   = ${WG_BIN_CHUNK_LEN};
////////////////////////////////////////////////////////////


struct UniformData {
    current_time: f32,
    debug_flags: u32,
    num_rough_shapes: u32,
    // todo: noise data
};

struct MiscData {
    num_fine_shapes: atomic<u32>,
    @align(128) histogram: array<atomic<u32>, 64>,

    //dispatch_indirect_rasterize_x: atomic<u32>,
    //dispatch_indirect_rasterize_y: atomic<u32>,
    //dispatch_indirect_rasterize_z: atomic<u32>,
};

struct MiscDataRead {
    num_fine_shapes: u32,
    @align(128) histogram: array<u32, 64>,

    //dispatch_indirect_rasterize_x: atomic<u32>,
    //dispatch_indirect_rasterize_y: atomic<u32>,
    //dispatch_indirect_rasterize_z: atomic<u32>,
};

// A basic particle.
struct RoughShape {
    world_position: vec2<f32>,
    world_velocity: vec2<f32>,

    world_size:    f32,
    start_time:    f32,
    duration_secs: f32,
    unused:        u32,

    color:         vec4<f32>,  // we could pack this if we wanted.
};


// This is our largest single buffer, so keep the size down.
struct FineShape {
    view_position: vec2<f32>,
    view_size_x: f32,
    packed_color: u32,
};

fn get_shape_color(shape: FineShape) -> vec4<f32> { return unpack4x8unorm(shape.packed_color); }

fn get_texture_linear_index(view_x: f32, view_y: f32) -> u32
{
    return u32(floor(view_x) + floor(view_y) * SCREEN_WIDTH_PX);
}


`;
