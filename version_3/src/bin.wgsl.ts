// webgpu-fireworks Copyright (C) 2023 Karl Pickett
// All rights reserved

import * as constants from "./constants.js";
export var BinCode = `

${constants.WGSL_INCLUDE}


@group(0) @binding(1) var<storage, read_write>  g_misc: MiscData;
@group(0) @binding(2) var<storage, read>        g_fine_shapes: array<FineShape>;
@group(0) @binding(3) var<storage, read_write>  g_fine_shapes_index: array<array<u32, MAX_FINE_SHAPES>, POINTER_BUCKETS>;

const WG_THREADS_X = 128;

@compute @workgroup_size(WG_THREADS_X)
fn bin_main(
    @builtin(num_workgroups) num_workgroups : vec3<u32>,  // dispatch() sizes
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    let total_shapes = atomicLoad(&g_misc.num_fine_shapes);
    let workgroup_start_idx = u32(workgroup_id.x * WG_BIN_WORKLOAD);
    let workgroup_end_idx = u32(min(workgroup_start_idx + WG_BIN_WORKLOAD, total_shapes));
    let ts = local_invocation_id.x;  // thread stride

    for (var i = workgroup_start_idx + ts; i < workgroup_end_idx; i += WG_THREADS_X) {
        // Find which spots on a 8x8 grid could be overlapped
        let shape_vpos = g_fine_shapes[i].view_position;
        let shape_vsize = g_fine_shapes[i].view_size_x;

        // Mark cols from [pos-size .. pos+size]
        var start_col = u32(floor((shape_vpos.x - shape_vsize) * 8 / SCREEN_WIDTH_PX));
        var end_col = u32(ceil((shape_vpos.x + shape_vsize) * 8 / SCREEN_WIDTH_PX));

        var start_row = u32(floor((shape_vpos.y - shape_vsize) * 8 / SCREEN_HEIGHT_PX));
        var end_row = u32(ceil((shape_vpos.y + shape_vsize) * 8 / SCREEN_HEIGHT_PX));

        start_col = max(start_col, 0);
        start_row = max(start_row, 0);
        end_col = min(end_col, 8);
        end_row = min(end_row, 8);

        for (var r = start_row; r < end_row; r++) {
            var pointer_flags = 0u;
            for (var c = start_col; c < end_col; c++) {
                atomicAdd(&g_misc.histogram[c + (r*8)], 1);
                pointer_flags |= (1u<<(c+24));
            }
            let row_idx = atomicAdd(&g_misc.num_fine_shapes_per_row[r], 1);
            let packed_pointer = u32(i) | pointer_flags;
            g_fine_shapes_index[r][row_idx] = packed_pointer;
        }
    }
}


`;