export var FragmentCode = `

struct VertexOut {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

struct LineWorkQueue {
    screen_x: f32,
    screen_y: f32,
    nr_segments: f32,
    unused: f32,
    color: vec4<f32>,
};

@group(0) @binding(0) var<uniform> g_work_queue: LineWorkQueue;

@group(0) @binding(1) var g_output_pixels: texture_2d<f32>;

@group(0) @binding(2) var mySampler: sampler;


@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
    var x = fragData.position.x / g_work_queue.screen_x;
    var y = fragData.position.y / g_work_queue.screen_y;

    /*
    if (x < 4) {
        return vec4(1., 0., 0., 1.);
    } else if (x < 100) {
        return vec4(0., 1., 0., 1.);
    } else if (x < 2000) {
        return vec4(0., 0., 1., 1.);
    } else if (x < 4000) {
        return vec4(0., 1., 1., 1.);
    } else {
        return vec4(1., 1., 1., 1.);
    }
    */

    //var ret = g_input_pixels[idx];
    return textureSample(g_output_pixels, mySampler, vec2(x, y));
    //return vec4(0., 1., 1., 1.);
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
