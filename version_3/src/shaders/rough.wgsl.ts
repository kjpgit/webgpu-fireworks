// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

import * as constants from "../constants.js";
export var RoughCode = `

${constants.WGSL_INCLUDE}

@group(0) @binding(0) var<uniform>              g_uniform: UniformData;
@group(0) @binding(1) var<storage, read_write>  g_misc: MiscData;
@group(0) @binding(2) var<storage, read>        g_rough_shapes: array<RoughShape>;
@group(0) @binding(3) var<storage, read_write>  g_fine_shapes: array<FineShape>;

//
// (current) Each workgroup processes 128 rough shapes
// (future) Each workgroup fully processes a single rough shape, which uses world space
// coordinates 0.0 ... 1.0.   0,0 is bottom left.
//
// Each thread generates a portion of its fine shapes, writing them to viewport
// coordinates 0.0 ... screen_px.  (0,0) is top left.
//

@compute @workgroup_size(WG_ROUGH_WORKLOAD)
fn rough_main(
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
)
{
    let rough_shape_index = i32(workgroup_id.x * WG_ROUGH_WORKLOAD + local_invocation_id.x);
    if (rough_shape_index >= g_uniform.num_rough_shapes) {
        return;
    }

    let shape = g_rough_shapes[rough_shape_index];
    let elapsed_secs = g_uniform.current_time - shape.start_time;

    if (elapsed_secs < 0) {
        // Not born yet -- we probably went back in time.
        return;
    }

    if (shape.duration_secs < elapsed_secs) {
        // Shape has expired
        return;
    }

    // Calculate physics and update world coordinates
    var world_position = shape.world_position;
    var shape_velocity = shape.world_velocity;

    // First, we apply rotation to the velocity
    if ((shape.flags & SHAPE_FLAG_ROTATE) != 0) {
        let angle = elapsed_secs * 2.0;
        shape_velocity = rotate_vector_y(shape_velocity, angle).xyz;
        shape_velocity = rotate_vector_x(shape_velocity, 0.785*2).xyz;
        //shape_velocity *= 2;
    }

    // Now apply movement from the velocity
    if ((shape.flags & SHAPE_FLAG_EXPLODE) != 0) {
        world_position.x += get_total_explosion_distance(elapsed_secs, shape_velocity.x);
        world_position.y += get_total_explosion_distance(elapsed_secs, shape_velocity.y);
    } else {
        shape_velocity.x /= SCREEN_ASPECT;
        world_position += shape_velocity / 10;
    }

    if ((shape.flags & SHAPE_FLAG_GRAVITY) != 0) {
        world_position.y += get_total_gravity_distance(elapsed_secs);
    }


    // The size is a world size, so it scales independently to height and width
    // A world size of 1.0 is the entire screen, tall and wide.
    let world_size = shape.world_size;

    // Remove any shape that has any dimension out of the world space
    if (min(world_position.x + world_size, world_position.y + world_size) < 0.0) {
        return;
    }
    if (max(world_position.x - world_size, world_position.y - world_size) > 1.0) {
        return;
    }

    // Project to viewport coordinates and save to rasterize work queue
    let view_x = world_position.x * SCREEN_WIDTH_PX;
    let view_y = SCREEN_HEIGHT_PX - (world_position.y * SCREEN_HEIGHT_PX);
    let view_size_x = world_size * SCREEN_WIDTH_PX;

    let color_ratio = 1 - smoothstep(0.0, shape.duration_secs, elapsed_secs);

    // Append to fine shape array
    let shape_index = atomicAdd(&g_misc.num_fine_shapes, 1);
    g_fine_shapes[shape_index].view_position.x = view_x;
    g_fine_shapes[shape_index].view_position.y = view_y;
    g_fine_shapes[shape_index].view_size_x = view_size_x;
    g_fine_shapes[shape_index].color = shape.color.rgb * color_ratio;

    // We could also update histogram, but lets not do too much in this shader,
    // so we can profile it easier.
}


// Simulate air drag - velocity tapers off exponentially
// todo: add variance (in the log2) for different surface area
fn get_total_explosion_distance(elapsed_secs: f32, velocity: f32) -> f32
{
    let distance = log2(10 * elapsed_secs + 1);
    return distance * velocity * 0.1;
}


// Simulate gravity with terminal velocity speed
// todo: blend the approach to terminal velocity, due to exponential air drag?
// todo: add variance for different surface area
fn get_total_gravity_distance(elapsed_secs: f32) -> f32
{
    const GRAVITY = -0.04;
    if (elapsed_secs > 1.0) {
        // terminal velocity: derivative(slope) of x^2 is 2x
        return GRAVITY * (2.0 * elapsed_secs - 1.0);
    } else {
        return GRAVITY * (elapsed_secs * elapsed_secs);
    }
}


fn rotate_vector_x(input: vec3<f32>, angle: f32) -> vec4<f32>
{
    let input2 = vec4<f32>(input.xyz, 1);
    let s = sin(angle);
    let c = cos(angle);
    let mat = mat4x4f(
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    );
    let ret = input2 * mat;
    return ret;
}

fn rotate_vector_y(input: vec3<f32>, angle: f32) -> vec4<f32>
{
    let input2 = vec4<f32>(input.xyz, 1);
    let s = sin(angle);
    let c = cos(angle);
    let mat = mat4x4f(
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    );
    let ret = input2 * mat;
    return ret;
}

`;
