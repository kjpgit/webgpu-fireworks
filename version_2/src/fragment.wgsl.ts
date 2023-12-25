export var FragmentCode = `

struct VertexOut {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

//@group(0) @binding(0) var<storage, read> g_work_queue: LineWorkQueue;

@group(0) @binding(1) var g_output_pixels: texture_2d<f32>;

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
    var x = fragData.position.x;
    var y = fragData.position.y;
    //var idx = u32(y * f32(g_work_queue.screen_x) + x);

    //var ret = g_input_pixels[idx];

    return vec4(0., 0., 1., 1.);
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
