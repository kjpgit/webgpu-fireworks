// webgpu-fireworks Copyright (C) 2023 Karl Pickett
// All rights reserved

import * as constants from "./constants.js";
export var RasterizeCode = `

${constants.WGSL_INCLUDE}


//@group(0) @binding(0) var<uniform>              g_uniform: UniformData;
@group(0) @binding(1) var<storage, read_write>    g_misc: MiscData;
@group(0) @binding(2) var<storage, read>        g_fine_shapes: array<FineShape>;
@group(0) @binding(3) var<storage, read_write>  g_color_buffer: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write>  g_fine_shapes_index: array<array<u32, MAX_FINE_SHAPES>, TILES_Y>;


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

//var<workgroup> private_color_storage: array<vec4<f32>, WG_RASTER_PIXELS_X*WG_RASTER_PIXELS_Y>;

@compute @workgroup_size(WG_THREADS_X, WG_THREADS_Y)
fn fine_main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // We process one logical tile out of the 8x8 grid
    let tile_x = workgroup_id.x;
    let tile_y = workgroup_id.y;
    let offset_x = (workgroup_id.z % 14) * 16;
    let offset_y = (workgroup_id.z / 14) * 16;

    /*
        // only do this if thread0,0
    let max_shapes = 1000;
    let job_count_previous = atomicAdd(&g_misc.histogram[tile_y][tile_x], -1 * max_shapes);
    let job_count_taken = min(job_count_previous, max_shapes);

    if (job_count_taken < 0) {
        return;
    }
    */


    // The view box this *workgroup* is responsible for.
    let wg_view_min = vec2<f32>(
        f32(workgroup_id.x * WG_RASTER_PIXELS_X + offset_x),
        f32(workgroup_id.y * WG_RASTER_PIXELS_Y + offset_y),
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

    let view_center = vec2<f32>(view_min.x+0.5, view_min.y+0.5);
    let clear_color = vec4<f32>(0.0, 0.2, 0.0, 1.0);
    var final_color = clear_color;


    // bitmap index scan
    let total_shapes = atomicLoad(&g_misc.num_fine_shapes_per_row[tile_y]);
    let shape_mask = (1u << (24 + tile_x));
    for (var s = 0u; s < total_shapes; s++) {
        let shape_idx = g_fine_shapes_index[tile_y][s];
        if ((shape_idx & shape_mask) == 0) {
            continue;
        }
        let shape = g_fine_shapes[shape_idx & 0xffffff];

    /*
    // dumb full array scan
    let total_shapes = atomicLoad(&g_misc.num_fine_shapes);
    for (var s = 0u; s < total_shapes; s++) {
        let shape = g_fine_shapes[shape_idx];
    */

        let shape_size = shape.view_size_x;
        let shape_vpos = shape.view_position;

        if (circle_bbox_check(shape_vpos, view_center) <= shape_size) {
            let pdistance = point_sdf(view_center, shape_vpos);
            let ratio = 1.0 - smoothstep(0.0, shape_size, pdistance);
            if (ratio > 0.0) {
                final_color += get_shape_color(shape) * ratio;
                //final_color += 0.01 * ratio;
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
