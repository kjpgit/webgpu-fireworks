export var ComputeCode = `

struct LineSegment {
    line_start: vec4<f32>,
    line_end: vec4<f32>,
    color_start: vec4<f32>,
    color_end: vec4<f32>,
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


@compute @workgroup_size(1)
fn compute_main(
    @builtin(local_invocation_index) local_invocation_index: u32,
    @builtin(global_invocation_id) global_invocation_id: vec3<u32>
)
{
    var x = global_invocation_id.x;
    var y = global_invocation_id.y;
    var color = g_work_queue.color;

    var x_ratio = f32(x) * 2. / g_work_queue.screen_x - 1.;
    var y_ratio = f32(y) * 2. / g_work_queue.screen_y - 1.;
    color.r = step(0.99, abs(x_ratio));
    color.g = step(0.99, abs(y_ratio));

    textureStore(g_output_pixels, vec2(x, y), color);


    //for (var i = 0u; i < arrayLength(&compute_mem); i++) {
    //for (var i = 0u; i < 3u; i++) {
        //compute_mem[i].processed_by = local_invocation_index;
        //compute_mem[i].output = compute_mem[i].input * 2;
    //}
}

// fn line_sdf( p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, aspect: f32 ) -> f32
// {
//     var pa = p-a;
//     var ba = b-a;
//     var h: f32 = saturate( dot(pa,ba) / dot(ba,ba) );
//     var d: vec2<f32> = pa - ba * h;
//     d.x *= aspect;
//     return length(d);
// }

// fn is_bbox(pos: vec2<f32>, c1: vec2<f32>, c2: vec2<f32>) -> u32 {
//     var d1 = distance(pos, c1);
//     var d2 = distance(pos, c2);
//     var d3 = distance(c1, c2);
//     if ((abs(d3 - (d2 + d1))) < 0.01) {
//         return 1;
//     }
//     return 0;
// }

`;
