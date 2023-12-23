import { BufferWrapper } from "./buffer.js";
import { Scene } from "./fireworks.js";


function do_throw(errorMessage: string): never {
    throw new Error(errorMessage);
}

const init = async () => {
    // Initialize - make sure we can initialize webgpu
    if (!navigator.gpu) {
        do_throw("WebGPU cannot be initialized - navigator.gpu not found");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        do_throw("WebGPU cannot be initialized - Adapter not found");
    }
    const device = await adapter.requestDevice();
    device.lost.then(() => {
        do_throw("WebGPU cannot be initialized - Device has been lost");
    });

    const canvas = <HTMLCanvasElement> document.getElementById("canvas-container") ?? do_throw("no canvas");
    const context = canvas.getContext("webgpu") ?? do_throw("Canvas does not support WebGPU");

    // Configure the swap chain
    const devicePixelRatio = window.devicePixelRatio || 1;
    console.log(`devicePixelRatio is ${devicePixelRatio}`);
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    console.log(`canvas pixels are ${canvas.width} x ${canvas.height}`);
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: presentationFormat,
        alphaMode: "opaque"
    });

    // Pack them all into one array
    // Each vertex has a position and a color packed in memory in X Y Z W R G B A order
    const MAX_BUFFER_SIZE = 20000000;
    const vertexBufferCPU = device.createBuffer({
        size: MAX_BUFFER_SIZE,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
    });

    const vertexBufferGPU = device.createBuffer({
        size: MAX_BUFFER_SIZE,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    const vertexBuffersDescriptors: GPUVertexBufferLayout[] = [
        {
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: "float32x4",
                },
                {
                    shaderLocation: 1,
                    offset: 16,
                    format: "float32x4",
                },
            ],
            arrayStride: 32,
            stepMode: "vertex",
        },
    ];

    // These are simple pass-through shaders, hopefully
    // I will try making more complex shaders in the future.
    //
    const shaderModule = device.createShaderModule({
        code: `
            struct VertexOut {
                @builtin(position) position : vec4<f32>,
                @location(0) color : vec4<f32>,
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
            @fragment
            fn fragment_main(fragData: VertexOut) -> @location(0) vec4<f32>
            {
                return fragData.color;
            }
        `,
    });

    // create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertex_main",
            buffers: vertexBuffersDescriptors,
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragment_main",
            targets: [
                {
                    format: presentationFormat,
                    blend: {
                        color: {
                            operation: "add",
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                        },
                        alpha: {  // not sure if we need this
                            operation: "add",
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                        }
                    }
                },
            ],
        },
        primitive: {
            topology: "triangle-list",
        },
        multisample: { count: 4, },

    });

    let renderTarget: GPUTexture | undefined = undefined;
    let renderTargetView: GPUTextureView;

    const scene = new Scene();
    var stats_time_start = 0
    var num_frames = 0

    async function frame(elapsedMs: DOMHighResTimeStamp) {
        // This isn't perfectly accurate (off by 1?), averaging the last 60
        // frametimes might be more precise.
        const elapsed_secs = elapsedMs / 1000
        if (elapsed_secs - stats_time_start > 1) {
            console.log(`fps: ${num_frames}`);
            num_frames = 0
            stats_time_start = elapsed_secs
        }
        num_frames += 1
        g_last_time = elapsed_secs

        const currentWidth = canvas.clientWidth * devicePixelRatio;
        const currentHeight = canvas.clientHeight * devicePixelRatio;

        // When the size changes, we need to reallocate the render target.
        // We also need to set the physical size of the canvas to match the computed CSS size.
        if (renderTarget == undefined || ((currentWidth !== canvas.width || currentHeight !== canvas.height) &&
            currentWidth && currentHeight))
        {
            if (renderTarget !== undefined) {
                // Destroy the previous render target
                renderTarget.destroy();
            }

            // Setting the canvas width and height will automatically resize the textures returned
            // when calling getCurrentTexture() on the context.
            canvas.width = currentWidth;
            canvas.height = currentHeight;

            renderTarget = device.createTexture({
                size: [canvas.width, canvas.height],
                sampleCount: 4,
                format: presentationFormat,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            renderTargetView = renderTarget.createView();
        }

        // Write into CPU buffer, then release it
        await vertexBufferCPU.mapAsync(GPUMapMode.WRITE);
        const cpu_buffer = new Float32Array(vertexBufferCPU.getMappedRange());
        const cpu_buffer_wrapper = new BufferWrapper(cpu_buffer);
        scene.set_screen_size(canvas.width, canvas.height)
        const scene_time = (g_pause_time == 0 ? elapsed_secs : g_pause_time) - g_pause_total;
        scene.draw(cpu_buffer_wrapper, scene_time);
        const cpu_buffer_bytes_used = cpu_buffer_wrapper.bytes_used();
        vertexBufferCPU.unmap();

        // GPU work starts here
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: renderTargetView,
                    resolveTarget: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "discard",
                },
            ],
        };

        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(vertexBufferCPU, 0, vertexBufferGPU, 0, cpu_buffer_bytes_used)

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBufferGPU);
        passEncoder.draw(cpu_buffer_wrapper.elements_used() / 8);
        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
};

const try_init = async () => {
    try {
        await init();
    } catch (err: any) {
        const errDiv = document.getElementById("error-message")!
        errDiv.classList.remove('hidden')
        errDiv.innerHTML = err.toString()
        throw err;
    }
};

try_init();

addEventListener("resize", (event) => {
    console.log("resized")
});

addEventListener('keydown', function (e) {
    console.log(`You pressed ${e.key}`);
    if (e.key == "f") {
        toggleFullScreen()
    }
    if (e.key == " ") {
        if (g_pause_time == 0) {
            g_pause_time = g_last_time;
        } else {
            g_pause_total += g_last_time - g_pause_time
            g_pause_time = 0;
        }
    }
    if (e.key == "j") {
        if (g_pause_time != 0) {
            g_pause_time -= 1/60;
        }
    }
    if (e.key == "k") {
        if (g_pause_time != 0) {
            g_pause_time += 1/60;
        }
    }
}, false);

addEventListener("dblclick", (event) => {
    console.log("doubleclick")
    toggleFullScreen()
});


var is_fullscreen = false;
var g_last_time = 0;
var g_pause_time = 0;
var g_pause_total = 0;

function toggleFullScreen() {
    if (is_fullscreen) {
        closeFullscreen();
        is_fullscreen = false;
    } else {
        openFullscreen();
        is_fullscreen = true;
    }
}

function openFullscreen() {
    let elem: any = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
    }
}

function closeFullscreen() {
    let elem: any = document;
    if (elem.exitFullscreen) {
        elem.exitFullscreen();
    } else if (elem.webkitExitFullscreen) { /* Safari */
        elem.webkitExitFullscreen();
    } else if (elem.msExitFullscreen) { /* IE11 */
        elem.msExitFullscreen();
    }
}
