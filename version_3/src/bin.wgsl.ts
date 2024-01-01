// webgpu-fireworks Copyright (C) 2023 Karl Pickett
// All rights reserved

import * as constants from "./constants.js";
export var BinCode = `

${constants.WGSL_INCLUDE}

@group(0) @binding(1) var<storage, read_write>  g_misc: MiscData;
@group(0) @binding(2) var<storage, read>        g_fine_shapes: array<FineShape>;

const WG_THREADS_X = 32;
@compute @workgroup_size(WG_THREADS_X)
fn bin_main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // Each WG processes WG_BIN_WORKLOAD fine shapes
    // Dispatch will be max 10000 / 128 = 79 WGs

    let total_shapes = atomicLoad(&g_misc.num_fine_shapes);
    let workgroup_start_idx = u32(workgroup_id.x * WG_BIN_WORKLOAD);
    let workgroup_end_idx = u32(min(workgroup_start_idx + WG_BIN_WORKLOAD, total_shapes));
    let ts = local_invocation_id.x;  // thread stride

    for (var i = workgroup_start_idx + ts; i < workgroup_end_idx; i += WG_THREADS_X) {
        // Find which cells are overlapped
        let shape_vpos = g_fine_shapes[i].view_position;
        let shape_vsize = g_fine_shapes[i].view_size_x;

        // Mark cols from [pos-size .. pos+size]
        var start_col = u32(floor((shape_vpos.x - shape_vsize) * NUM_TILES_X / SCREEN_WIDTH_PX));
        var end_col = u32(ceil((shape_vpos.x + shape_vsize) * NUM_TILES_X / SCREEN_WIDTH_PX));

        var start_row = u32(floor((shape_vpos.y - shape_vsize) * NUM_TILES_Y / SCREEN_HEIGHT_PX));
        var end_row = u32(ceil((shape_vpos.y + shape_vsize) * NUM_TILES_Y / SCREEN_HEIGHT_PX));

        start_col = max(start_col, 0);
        start_row = max(start_row, 0);
        end_col = min(end_col, NUM_TILES_X);
        end_row = min(end_row, NUM_TILES_Y);

        for (var y = start_row; y < end_row; y++) {
            for (var x = start_col; x < end_col; x++) {
                atomicAdd(&g_misc.histogram[y][x], 1);
            }
        }
    }
}


@compute @workgroup_size(WG_BIN2_WORKLOAD)
fn bin_main2(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // Each WG processes 32 tiles (1 per thread)
    // Dispatch will be 4480 / 32 = 140.0 WGs

    let workgroup_start_idx = u32(workgroup_id.x * WG_BIN2_WORKLOAD);
    let my_tile_id = workgroup_start_idx + local_invocation_id.x;  // thread stride

    let x = i32(my_tile_id % NUM_TILES_X);
    let y = i32(my_tile_id / NUM_TILES_X);

    let num_pointers = atomicLoad(&g_misc.histogram[y][x]);

    // Allocate contiguous memory chunk
    let pointers_start = atomicAdd(&g_misc.num_fine_pointers, num_pointers);

    // Write the index (we will populate data later, in step 3)
    g_misc.tile_shape_index[y][x].offset = pointers_start;

    // This is a duplicate of ths histogram, but whatever.
    // We don't need to re-mark the atomic memory as read-only
    g_misc.tile_shape_index[y][x].num_pointers = num_pointers;
}


@compute @workgroup_size(WG_BIN3_WORKLOAD)
fn bin_main2(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // Now we write out the sorted pointers.
    // Each WG processes WG_BIN3_WORKLOAD fine shapes

    let total_shapes = atomicLoad(&g_misc.num_fine_shapes);
    let workgroup_start_idx = u32(workgroup_id.x * WG_BIN_WORKLOAD);
    let workgroup_end_idx = u32(min(workgroup_start_idx + WG_BIN_WORKLOAD, total_shapes));
    let ts = local_invocation_id.x;  // thread stride

    for (var i = workgroup_start_idx + ts; i < workgroup_end_idx; i += WG_THREADS_X) {
        // Find which cells are overlapped
        let shape_vpos = g_fine_shapes[i].view_position;
        let shape_vsize = g_fine_shapes[i].view_size_x;

        // Mark cols from [pos-size .. pos+size]
        var start_col = u32(floor((shape_vpos.x - shape_vsize) * NUM_TILES_X / SCREEN_WIDTH_PX));
        var end_col = u32(ceil((shape_vpos.x + shape_vsize) * NUM_TILES_X / SCREEN_WIDTH_PX));

        var start_row = u32(floor((shape_vpos.y - shape_vsize) * NUM_TILES_Y / SCREEN_HEIGHT_PX));
        var end_row = u32(ceil((shape_vpos.y + shape_vsize) * NUM_TILES_Y / SCREEN_HEIGHT_PX));

        start_col = max(start_col, 0);
        start_row = max(start_row, 0);
        end_col = min(end_col, NUM_TILES_X);
        end_row = min(end_row, NUM_TILES_Y);

        for (var y = start_row; y < end_row; y++) {
            for (var x = start_col; x < end_col; x++) {
                atomicAdd(&g_misc.histogram[y][x], 1);
            }
        }

}


`;
