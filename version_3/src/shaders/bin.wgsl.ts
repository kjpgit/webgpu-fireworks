// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved
// Galaxy Engine - Copyright (C) 2023 Karl Pickett

import * as constants from "../constants.js";
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
    let workgroup_start_idx = i32(workgroup_id.x * WG_BIN_WORKLOAD);
    let workgroup_end_idx = i32(min(workgroup_start_idx + WG_BIN_WORKLOAD, total_shapes));
    let ts = i32(local_invocation_id.x);  // thread stride

    for (var i = workgroup_start_idx + ts; i < workgroup_end_idx; i += WG_THREADS_X) {
        // Find which cells are overlapped
        let info = get_containing_tiles(g_fine_shapes[i]);

        for (var y = info.start_row; y < info.end_row; y++) {
            for (var x = info.start_col; x < info.end_col; x++) {
                atomicAdd(&g_misc.num_shapes_per_tile[y][x], 1);
            }
        }
    }
}


@compute @workgroup_size(WG_BIN2_WORKLOAD)
fn bin2_main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // Each WG processes 32 tiles (1 per thread)
    // Dispatch will be 4480 / 32 = 140.0 WGs

    let workgroup_start_idx = i32(workgroup_id.x * WG_BIN2_WORKLOAD);
    let my_tile_id = workgroup_start_idx + i32(local_invocation_id.x);  // thread stride

    let x = i32(my_tile_id % NUM_TILES_X);
    let y = i32(my_tile_id / NUM_TILES_X);

    let num_pointers = atomicLoad(&g_misc.num_shapes_per_tile[y][x]);

    // Allocate contiguous memory chunk
    let pointers_start = atomicAdd(&g_misc.num_fine_pointers, num_pointers);

    // Write the index (we will populate data later, in step 3)
    g_misc.tile_shape_index[y][x].offset = pointers_start;

    // This is a duplicate of ths histogram, but whatever.
    // We don't need to re-mark the atomic memory as read-only
    g_misc.tile_shape_index[y][x].length = num_pointers;

    // Clear this counter so step 3 can use it
    atomicStore(&g_misc.num_shapes_per_tile[y][x], 0);
}


@compute @workgroup_size(WG_THREADS_X)
fn bin3_main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    // Now we write out the sorted pointers.
    // Each WG processes WG_BIN_WORKLOAD fine shapes
    // (Same as step 1)

    let total_shapes = atomicLoad(&g_misc.num_fine_shapes);
    let workgroup_start_idx = i32(workgroup_id.x * WG_BIN_WORKLOAD);
    let workgroup_end_idx = i32(min(workgroup_start_idx + WG_BIN_WORKLOAD, total_shapes));
    let ts = i32(local_invocation_id.x);  // thread stride

    for (var i = workgroup_start_idx + ts; i < workgroup_end_idx; i += WG_THREADS_X) {
        // Find which cells are overlapped
        let info = get_containing_tiles(g_fine_shapes[i]);

        for (var y = info.start_row; y < info.end_row; y++) {
            for (var x = info.start_col; x < info.end_col; x++) {
                // We already have the base pointer address allocated and stored
                let bucket_start = g_misc.tile_shape_index[y][x].offset;
                let offset = atomicAdd(&g_misc.num_shapes_per_tile[y][x], 1);
                g_misc.tile_shape_pointers[bucket_start + offset] = i;
            }
        }
    }
}


fn get_containing_tiles(shape: FineShape) -> FineShapeOverlap
{
    var ret: FineShapeOverlap;

    let shape_vpos = shape.view_position;
    let shape_vsize = shape.view_size_x;

    // Mark cols from [pos-size .. pos+size]
    ret.start_col = i32(floor((shape_vpos.x - shape_vsize) * NUM_TILES_X / SCREEN_WIDTH_PX));
    ret.end_col = i32(ceil((shape_vpos.x + shape_vsize) * NUM_TILES_X / SCREEN_WIDTH_PX));

    ret.start_row = i32(floor((shape_vpos.y - shape_vsize) * NUM_TILES_Y / SCREEN_HEIGHT_PX));
    ret.end_row = i32(ceil((shape_vpos.y + shape_vsize) * NUM_TILES_Y / SCREEN_HEIGHT_PX));

    ret.start_col = max(ret.start_col, 0);
    ret.start_row = max(ret.start_row, 0);
    ret.end_col = min(ret.end_col, NUM_TILES_X);
    ret.end_row = min(ret.end_row, NUM_TILES_Y);

    return ret;
}

struct FineShapeOverlap {
    start_col: i32,
    end_col: i32,
    start_row: i32,
    end_row: i32,
};


`;
