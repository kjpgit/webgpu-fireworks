// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved
// Galaxy Engine - Copyright (C) 2023 Karl Pickett

import * as constants from "../constants.js";
export var FragmentCode = `

${constants.WGSL_INCLUDE}

@group(0) @binding(0) var<storage, read>  g_color_buffer: array<vec3<f32>>;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
}

@vertex
fn vertex_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  const pos = array(
    vec2( 1.0,  1.0),
    vec2( 1.0, -1.0),
    vec2(-1.0, -1.0),
    vec2( 1.0,  1.0),
    vec2(-1.0, -1.0),
    vec2(-1.0,  1.0),
  );

  var output : VertexOutput;
  output.position = vec4(pos[VertexIndex], 0.0, 1.0);
  return output;
}


@fragment
fn fragment_main(@builtin(position) fb_pos: vec4<f32>) -> @location(0) vec4<f32> {
    let fb_linear = get_texture_linear_index(fb_pos.x, fb_pos.y);
    var color = g_color_buffer[fb_linear];
    return vec4<f32>(color, 1.0);
}


`;
