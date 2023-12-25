export var FragmentCode = `

struct VertexOut {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

struct LineWorkQueue {
    screen_x: f32,
    screen_y: f32,
    nr_segments: f32,
    color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> g_work_queue: LineWorkQueue;

@group(0) @binding(1) var<storage, read> g_input_pixels: array<vec4<f32>>;

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
    var x = fragData.position.x;
    var y = fragData.position.y;
    var idx = u32(y * f32(g_work_queue.screen_x) + x);

    var ret = g_input_pixels[idx];

    return ret;
}

@vertex
fn vertex_main(@location(0) position: vec4<f32>,
            @location(1) color: vec4<f32>) -> VertexOut
{
    var output : VertexOut;
    output.position = position;
    output.color = color;
    return output;
}


`;
