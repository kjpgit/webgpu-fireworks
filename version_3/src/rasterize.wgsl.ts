// webgpu-fireworks Copyright (C) 2023 Karl Pickett
// All rights reserved

import * as constants from "./constants.js";
export var RasterizeCode = `

${constants.WGSL_INCLUDE}


//@group(0) @binding(0) var<uniform>              g_uniform: UniformData;
@group(0) @binding(1) var<storage, read>        g_misc: MiscDataRead;
@group(0) @binding(2) var<storage, read>        g_fine_shapes: array<FineShape>;
@group(0) @binding(3) var<storage, read_write>  g_color_buffer: array<vec4<f32>>;


//
// Rasterize fine shapes, writing to atomic texture memory.
//
// Each workgroup is assigned a rectangular section of screen pixels,
// and fully processes it.
//
// Each thread in the workgroup processes a portion of the pixel area.
//
const WG_THREADS_X = 16;
const WG_THREADS_Y = 16;

//const THREAD_PIXELS_X = WG_RASTER_PIXELS_X / WG_THREADS_X;
//const THREAD_PIXELS_Y = WG_RASTER_PIXELS_Y / WG_THREADS_Y;

// WebGPU only guarantees 16,384 bytes of WG storage.
// That's only 1024 RGBA float colors, enough for a 32x32 pixel tile.
// We'd need exactly 2025 workgroups to process HD (1920x1080).
// The problem is that each workgroup will (re)scan the shape array.
// The question is, do we optimize reads, or writes?  We can't do both.
//
//var<workgroup> private_color_storage: array<vec4<f32>, WG_RASTER_PIXELS_X*WG_RASTER_PIXELS_Y>;

@compute @workgroup_size(WG_THREADS_X, WG_THREADS_Y)
fn fine_main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // The view box this *workgroup* is responsible for.
    let wg_view_min = vec2<f32>(
        f32(workgroup_id.x * WG_RASTER_PIXELS_X),
        f32(workgroup_id.y * WG_RASTER_PIXELS_Y),
    );

    // The view box this *thread* is responsible for.
    let view_min = vec2<f32>(
        wg_view_min.x + f32(local_invocation_id.x),
        wg_view_min.y + f32(local_invocation_id.y),
    );

    let view_max = vec2<f32>(
        view_min.x + 1.0,
        view_min.y + 1.0,
    );

    if (view_max.x > SCREEN_WIDTH_PX || view_max.y > SCREEN_HEIGHT_PX) {
        return;
    }

    let clear_color = vec4<f32>(0.0, 0.2, 0.0, 1.0);
    var final_color = clear_color;

    // Now the fun happens.  Brute force scan of 1 mil shapes.
    //let total_shapes = atomicLoad(&g_misc.num_fine_shapes);
    let total_shapes = g_misc.num_fine_shapes;
    let view_center = vec2<f32>(view_min.x+0.5, view_min.y+0.5);

    for (var s = 0u; s < total_shapes; s++) {
        let shape_size = g_fine_shapes[s].view_size_x;
        let shape_vpos = g_fine_shapes[s].view_position;

        if (circle_bbox_check(shape_vpos, view_center) <= shape_size) {
            let pdistance = point_sdf(view_center, shape_vpos);
            let ratio = 1.0 - smoothstep(0.0, shape_size, pdistance);
            if (ratio > 0.0) {
                final_color += get_shape_color(g_fine_shapes[s]) * ratio;
            }
        }
    }

    // Update main memory
    output_texture_store(view_center.x, view_center.y, final_color);
}


fn point_sdf(p: vec2<f32>, a: vec2<f32>) -> f32
{
    let pa = p-a;
    //return dot(pa,pa);  // can be related but not exact
    return length(pa);
}

fn output_texture_add(view_x: f32, view_y: f32, color: vec4<f32>)
{
    let fb_linear = get_texture_linear_index(view_x, view_y);
    g_color_buffer[fb_linear] += color;
}

fn output_texture_store(view_x: f32, view_y: f32, color: vec4<f32>)
{
    let fb_linear = get_texture_linear_index(view_x, view_y);
    g_color_buffer[fb_linear] = color;
}


// Workgroup fast memory
//
/*
fn output_texture_add_private(view_x: f32, view_y: f32, color: vec4<f32>)
{
    let private_linear = u32(floor(view_x) + floor(view_y) * WG_RASTER_PIXELS_X);
    private_color_storage[private_linear] += color;
}

fn output_texture_get_private(view_x: f32, view_y: f32) -> vec4<f32>
{
    let private_linear = u32(floor(view_x) + floor(view_y) * WG_RASTER_PIXELS_X);
    return private_color_storage[private_linear];
}
*/

// From stackoverflow
fn is_in_box(v: vec2<f32>, bottomLeft: vec2<f32>, topRight: vec2<f32>) -> f32
{
    //       (1 if v >= bottomleft) - (0 if v < bottomright) = 1 ok
    //       1 - 1 = 0 not ok
    //       0 - 0 = 0 not ok
    //       0 - 1 = -1 not ok
    let s = step(bottomLeft, v)  - step(topRight, v);
    return s.x * s.y;
}


// Return conservative distance estimate
fn circle_bbox_check(c1: vec2<f32>, c2: vec2<f32>) -> f32
{
    return min(abs(c1.x-c2.x), abs(c1.y-c2.y));
}


`;
