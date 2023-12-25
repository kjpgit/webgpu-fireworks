export var FragmentCode = `

struct VertexOut {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

struct InputData {
    screen_x: f32,
    screen_y: f32,
    unused_a: f32,
    unused_b: f32,
    lines: array<InputLine>,
};

struct InputLine {
    line_start: vec4<f32>,
    line_end: vec4<f32>,
    line_color: vec4<f32>,
};

@vertex
fn vertex_main(@location(0) position: vec4<f32>,
            @location(1) color: vec4<f32>) -> VertexOut
{
    var output : VertexOut;
    output.position = position;
    output.color = color;
    return output;
}

@group(0) @binding(0) var<storage,read> buffer0: InputData;

fn Line( p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, aspect: f32 ) -> f32
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

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
{
    //return fragData.color;
    var uv = vec2<f32>(fragData.position.x * 2/buffer0.screen_x - 1.,
                       fragData.position.y * -2/buffer0.screen_y + 1.);
    var aspect = buffer0.screen_x / buffer0.screen_y;
    //var uv = vec2<f32>(fragData.position.x/1024, fragData.position.y/1024);
    var ret = vec4<f32>(0.0);
    var num_lines: u32 = u32(buffer0.unused_a);
    //var num_lines: u32 = arrayLength(&buffer0.lines);

    for (var i = 0u; i < num_lines; i++) {
        var line_start = buffer0.lines[i].line_start.xy;
        var line_end = buffer0.lines[i].line_end.xy;

        if (is_bbox(uv, line_start, line_end) > 0) {
            var line_color = buffer0.lines[i].line_color;
            ret = line_color;
            //var k = Line(uv, line_start, line_end, aspect);
            //var k = Line(uv, vec2<f32>(0.01,0.01), vec2<f32>(0.99,0.99));

            //var thickness = 0.01;
            //var ratio = smoothstep(0.0, thickness, k);
            //var newColor = mix(line_color, vec4<f32>(0,0,0,0), ratio);
            //newColor.r *= newColor.a;
            //newColor.g *= newColor.a;
            //newColor.b *= newColor.a;
            //ret = max(ret, newColor);
        }
    }
    return ret;
}
`;
