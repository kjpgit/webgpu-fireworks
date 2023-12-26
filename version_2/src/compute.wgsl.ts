export var ComputeCode = `

const WORKGROUP_SIZE_X = 128;
const WORKGROUP_SIZE_Y = 64;

struct WorkQueue {
    index: array<LineIndex, WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y>,
    segments: array<LineSegment>,
}

struct LineIndex {
    start_index: f32,
    num_segments: f32,
}

struct LineSegment {
    line_start: vec2<f32>,
    size: f32,
    una: f32,
    color_start: vec4<f32>,
};

struct UniformData {
    screen_x: f32,
    screen_y: f32,
    nr_segments: f32,
    unused: f32,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> g_uniform: UniformData;

@group(0) @binding(1) var<storage, read> g_work_queue: WorkQueue;

@group(0) @binding(2) var g_output_pixels: texture_storage_2d<rgba8unorm, write>;


@compute @workgroup_size(4,8)
fn compute_main(
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(global_invocation_id) global_invocation_id: vec3<u32>
)
{
    var x = global_invocation_id.x;
    var y = global_invocation_id.y;

    var x_ratio = f32(x) / g_uniform.screen_x;
    var y_ratio = f32(y) / g_uniform.screen_y;
    y_ratio = 1 - y_ratio;

    if (false) {
        // Screen test pattern
        var color = g_uniform.color;
        color.r = step(0.494, abs(x_ratio-0.5));
        color.g = step(0.494, abs(y_ratio-0.5));
        color.b *= abs(x_ratio);
        textureStore(g_output_pixels, vec2(x, y), color);
        return;
    }

    if (false) {
        // Workqueue tile grid
        var tile_x = step(0.5, fract(x_ratio * WORKGROUP_SIZE_X / 2));
        var color = vec4<f32>(tile_x, tile_x, tile_x, 1.0);
        textureStore(g_output_pixels, vec2(x, y), color);
        return;
    }

    if (true) {
        // Rasterize segments
        var my_block_id = u32(floor(x_ratio * WORKGROUP_SIZE_X))
                        + u32(floor(y_ratio * WORKGROUP_SIZE_Y) * WORKGROUP_SIZE_X);

        var start_index = u32(g_work_queue.index[my_block_id].start_index);
        var num_segments = u32(g_work_queue.index[my_block_id].num_segments);
        //var num_segments = 1000u;

        var position = vec2<f32>(x_ratio, y_ratio);
        var color = vec4<f32>(0., 0., 0., 0.);

        for (var i = 0u; i < num_segments; i++) {
            var segment = g_work_queue.segments[start_index + i];

            var distance = point_sdf(position, segment.line_start, 1.0);
            var ratio = 1.0 - smoothstep(0.0, segment.size, distance);
            var new_color = segment.color_start;
            new_color *= ratio;
            new_color.r *= new_color.a;
            new_color.g *= new_color.a;
            new_color.b *= new_color.a;
            color += new_color;
        }
        textureStore(g_output_pixels, vec2(x, y), color);
    }
}

fn point_sdf( p: vec2<f32>, a: vec2<f32>, aspect: f32 ) -> f32
{
    var pa = p-a;
    return length(pa);
}

/*
fn line_sdf( p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, aspect: f32 ) -> f32
{
    var pa = p-a;
    var ba = b-a;
    var h: f32 = saturate( dot(pa,ba) / dot(ba,ba) );
    var d: vec2<f32> = pa - ba * h;
    d.x *= aspect;
    return length(d);
}

fn is_bbox(pos: vec2<f32>, c1: vec2<f32>, c2: vec2<f32>) -> u32 {
    var d1 = distance(pos, c1);
    var d2 = distance(pos, c2);
    var d3 = distance(c1, c2);
    if ((abs(d3 - (d2 + d1))) < 0.01) {
        return 1;
    }
    return 0;
}
*/

`;
