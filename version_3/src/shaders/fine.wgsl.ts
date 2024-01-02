// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

import * as constants from "../constants.js";
export var FineCode = `

${constants.WGSL_INCLUDE}


@group(0) @binding(0) var<uniform>              g_uniform: UniformData;
@group(0) @binding(1) var<storage, read>        g_misc: MiscDataRead;
@group(0) @binding(2) var<storage, read>        g_fine_shapes: array<FineShape>;
@group(0) @binding(3) var<storage, read_write>  g_color_buffer: array<vec3<f32>>;


// Testing with 40k x2 locked frame (GPU avg ms)
// Frame 1/60   Num blends = 137k
// -------------------------------------------------
// noop         = 14 - 16  (although cpu and gpu load is high)
// heatmap      = 160
// heatmap2     = 260   // wow, most of the work is just basic math
// monochrome   = 300
// monochrome with full shape scan = 1400-1700
// normal       = 300
// normal nobbox = 300 (no difference with 1/60 frame)
// normal_integrated_bbox = 300
// smoothstep normal = 330

// Frame 50/60  Num blends = 112k
// -------------------------------------------------
// normal       = 265-280ms
// normal nobbox = 270-280


const PERFORMANCE_TEST_NOOOP      = false;
const PERFORMANCE_TEST_HEATMAP    = false;
const PERFORMANCE_TEST_MONOCHROME = false;


//
// Rasterize fine shapes, writing to texture memory.
//
//
const WG_RASTER_WORKLOAD = 256;

//var<workgroup> shape: FineShape;

@compute @workgroup_size(16, 16)
fn fine_main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // Each WG processes 1 tile, which contains 256 pixels (1 pixel per thread)
    // Dispatch will be 4480 WGs

    let my_tile_id = i32(workgroup_id.x);
    let x = i32(my_tile_id % NUM_TILES_X);
    let y = i32(my_tile_id / NUM_TILES_X);

    // The view box this *workgroup* is responsible for.
    let wg_view_min = vec2<f32>(
        f32(x * TILE_SIZE_X),
        f32(y * TILE_SIZE_Y),
    );

    // The view box this *thread* is responsible for.
    let view_min = vec2<f32>(
        wg_view_min.x + f32(local_invocation_id.x),
        wg_view_min.y + f32(local_invocation_id.y),
    );

    if (false) {
        let view_max = vec2<f32>(
            view_min.x + 1.0,
            view_min.y + 1.0,
        );

        // This check should never be needed, we use even tile divisions
        // In fact, this check causes uniform control flow proof failures,
        // even when if(false) :(
        //if (view_max.x > SCREEN_WIDTH_PX || view_max.y > SCREEN_HEIGHT_PX) {
            //return;
        //}
    }

    let view_center = vec2<f32>(view_min.x+0.5, view_min.y+0.5);
    let clear_color = vec3<f32>(0.0, 0.1, 0.0);
    var final_color = clear_color;

    if (!PERFORMANCE_TEST_NOOOP) {
        // hashtable scan
        let ptr_offset = g_misc.tile_shape_index[y][x].offset;
        let num_ptrs = g_misc.tile_shape_index[y][x].length;

        if (num_ptrs > 0 && (g_uniform.debug_flags & DEBUG_SHOW_ACTIVE_TILES) != 0) {
            final_color.r += 0.5;
        }

        for (var s = 0; s < num_ptrs; s++) {
            let shape_idx = g_misc.tile_shape_pointers[ptr_offset + s];
            let shape = g_fine_shapes[shape_idx];
            //workgroupBarrier();  // Great way to prove we have uniform control flow!

            let shape_size = shape.view_size_x;
            let shape_vpos = shape.view_position;

            if (PERFORMANCE_TEST_HEATMAP) {
                final_color.r += 0.01;
            } else {
                // Real work
                let rough_dist = abs(shape_vpos - view_center);
                let rough_check = min(rough_dist.x, rough_dist.y);
                if (rough_check <= shape_size) {
                    let pdistance = length(rough_dist);
                    //let ratio = 1.0 - smoothstep(0.0, shape_size, pdistance);
                    let ratio = 1.0 - step(shape_size, pdistance);

                    // This check seems to have a tiny performance benefit
                    if (ratio > 0.0) {
                        if (PERFORMANCE_TEST_MONOCHROME) {
                            final_color.b = 1.0;
                        } else {
                            final_color += shape.color * ratio;
                        }
                    }
                }
            }
        }
    }

    output_texture_store(view_center.x, view_center.y, final_color);
}


fn output_texture_store(view_x: f32, view_y: f32, color: vec3<f32>)
{
    let fb_linear = get_texture_linear_index(view_x, view_y);
    g_color_buffer[fb_linear] = color;
}



/*
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

fn point_sdf(p: vec2<f32>, a: vec2<f32>) -> f32
{
    let pa = p-a;
    //return dot(pa,pa);  // can be related but not exact
    return length(pa);
}

*/


`;
