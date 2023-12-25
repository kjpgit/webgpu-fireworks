export var ComputeCode = `

struct LineSegment {
    line_start: vec2<f32>,
    size: f32,
    una: f32,
    color_start: vec4<f32>,
};

struct LineWorkQueue {
    screen_x: f32,
    screen_y: f32,
    nr_segments: f32,
    unused: f32,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> g_work_queue: LineWorkQueue;

@group(0) @binding(1) var<storage, read> g_line_segments: array<LineSegment>;

@group(0) @binding(2) var g_output_pixels: texture_storage_2d<rgba8unorm, write>;


@compute @workgroup_size(4,8)
fn compute_main(
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(global_invocation_id) global_invocation_id: vec3<u32>
)
{
    var x = global_invocation_id.x;
    var y = global_invocation_id.y;

    var x_ratio = f32(x) / g_work_queue.screen_x;
    var y_ratio = f32(y) / g_work_queue.screen_y;
    y_ratio *= -1.0;

    if (false) {
        // Screen test pattern
        var color = g_work_queue.color;
        color.r = step(0.994, abs(x_ratio));
        color.g = step(0.994, abs(y_ratio));
        color.b *= abs(x_ratio);
        textureStore(g_output_pixels, vec2(x, y), color);
    }

    if (true) {
        // Rasterize line segments
        var position = vec2<f32>(x_ratio, y_ratio);
        //var num_segments = 1000u;
        var num_segments = arrayLength(&g_line_segments);
        var color = vec4<f32>(0., 0., 0., 0.);
        for (var i = 0u; i < num_segments; i++) {
            //if (is_bbox(position, g_line_segments[i].line_start, g_line_segments[i].line_end) > 0) {
            if (true) {
                var distance = point_sdf(position, g_line_segments[i].line_start, 1.9);
                var ratio = 1.0 - smoothstep(0.0, g_line_segments[i].size, distance);
                var new_color = g_line_segments[i].color_start;
                new_color *= ratio;
                new_color.r *= new_color.a;
                new_color.g *= new_color.a;
                new_color.b *= new_color.a;
                color += new_color;
            }
        }
        textureStore(g_output_pixels, vec2(x, y), color);
    }
}

fn point_sdf( p: vec2<f32>, a: vec2<f32>, aspect: f32 ) -> f32
{
    var pa = p-a;
    return length(pa);
}

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

`;
