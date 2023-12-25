import { BufferWrapper } from "./buffer.js"
import { Scene } from "./fireworks.js"
import { ComputeCode } from "./compute.wgsl.js"
import { FragmentCode } from "./fragment.wgsl.js"


export function do_throw(errorMessage: string): never {
    throw new Error(errorMessage)
}


class Main
{
    is_fullscreen = false
    last_time = 0
    pause_time = 0
    pause_total = 0
    stats_time_start = 0
    num_frames = 0
    scene: Scene

    constructor() {
        this.scene = new Scene()

        addEventListener("dblclick", e => this.on_double_click(e))
        addEventListener("keydown", e => this.on_keydown(e))
        addEventListener("resize", e => this.on_resize(e))
    }

    on_resize(event: Event) {
        console.log("resized")
    }

    on_keydown(e: KeyboardEvent) {
        console.log(`You pressed ${e.key}`)
        if (e.key == "f") {
            this.toggleFullScreen()
        }
        if (e.key == " ") {
            if (this.pause_time == 0) {
                this.pause_time = this.last_time
            } else {
                this.pause_total += this.last_time - this.pause_time
                this.pause_time = 0
            }
        }
        if (e.key == "j") {
            if (this.pause_time != 0) {
                this.pause_time -= 1/60
            }
        }
        if (e.key == "k") {
            if (this.pause_time != 0) {
                this.pause_time += 1/60
            }
        }
    }

    on_double_click(event: Event) {
        console.log("doubleclick")
        this.toggleFullScreen()
    }


    toggleFullScreen() {
        if (this.is_fullscreen) {
            this.closeFullscreen()
            this.is_fullscreen = false
        } else {
            this.openFullscreen()
            this.is_fullscreen = true
        }
    }

    openFullscreen() {
        let elem: any = document.documentElement
        if (elem.requestFullscreen) {
            elem.requestFullscreen()
        } else if (elem.webkitRequestFullscreen) { /* Safari */
            elem.webkitRequestFullscreen()
        } else if (elem.msRequestFullscreen) { /* IE11 */
            elem.msRequestFullscreen()
        }
    }

    closeFullscreen() {
        let elem: any = document
        if (elem.exitFullscreen) {
            elem.exitFullscreen()
        } else if (elem.webkitExitFullscreen) { /* Safari */
            elem.webkitExitFullscreen()
        } else if (elem.msExitFullscreen) { /* IE11 */
            elem.msExitFullscreen()
        }
    }

    draw_uniform(width: number, height: number, elapsedSecs: number, buffer: BufferWrapper) {
        const delta = Math.sin(elapsedSecs * 8) / 8;
        var vertices = [
            width, height, 4, 0,
            0.0 + delta, -0.2, 1, 1,
            0.95, 0.95, 1, 1,
            0.0, 1.0, 0.0, 1,

            -0.95, 0.95, 1, 1,
            -0.95, -0.95, 1, 1,
            1.0, 0.0, 1.0, 1,

            0.0, 0.0, 1, 1,
            0.0, -0.95, 1, 1,
            0.0, 0.0, 1.0, 1,

            -0.8, -0.1, 1, 1,
            0.8, -0.1, 1, 1,
            1.0, 0.0, 0.0, 1,
        ]
        for (const f of vertices) {
            buffer.append_raw(f)
        }
    }

}


const init_webgpu = async (main: Main) => {
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
    const MAX_BUFFER_SIZE = 20000000;
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


    // COMPUTE SHADER
    const computeBGL = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,  // global constants - read only
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "uniform", },
            },
            {
                binding: 1,  // line segments - read only
                visibility: GPUShaderStage.COMPUTE,
                buffer: { type: "storage", },
            },
            {
                binding: 2,  // full screen texture to write to
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: { access: "write-only", format: "rgba8unorm", },
            },
        ],
    });

    const computePL = device.createPipelineLayout({
        bindGroupLayouts: [
            computeBGL, // @group(0)
        ]
    });

    const computeModule = device.createShaderModule({
        label: 'computeModule',
        code: ComputeCode,
    });


    const computePipeline = device.createComputePipeline({
        layout: computePL,
        compute: { module: computeModule, entryPoint: 'compute_main',
        },
    });

    const global_constants = new Float32Array([
        canvas.width,
        canvas.height,
        100,  // nr_segments,
        99,
        1, 1, 0, 1, // color
        99, 99, 99, 99, // fill
    ]);

    const constantsBuffer = device.createBuffer({
        size: global_constants.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(constantsBuffer, 0, global_constants);

//    const resultBuffer = device.createBuffer({
//        size: global_constants.byteLength,
//        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
//    });

    const segmentBuffer = device.createBuffer({
        size: 100000,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    //const pixelBuffer = device.createBuffer({
        //size: canvas.width * canvas.height * 4,
        //usage: GPUBufferUsage.STORAGE,
    //});
    const pixelBuffer = device.createTexture({
        size: [canvas.width, canvas.height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    })

    const computeBG = device.createBindGroup({
        layout: computeBGL,
        entries: [
            { binding: 0, resource: { buffer: constantsBuffer } },
            { binding: 1, resource: { buffer: segmentBuffer } },
            //{ binding: 2, resource: { texture: pixelBuffer } },
            { binding: 2, resource: pixelBuffer.createView() }

        ],
    });



    // FRAGMENT
    const fragmentBGL = device.createBindGroupLayout({
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: "uniform", },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { },
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: "filtering" },
            },
        ],
    });

    const fragmentPL = device.createPipelineLayout({
        bindGroupLayouts: [
            fragmentBGL, // @group(0)
        ]
    });

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
        code: FragmentCode,
        label: 'fragment',
    });

    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    // create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: fragmentPL,
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
                    /*
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
                   */
                },
            ],
        },
        primitive: {
            topology: "triangle-list",
        },
        multisample: { count: 1, },
    });

    const fragmentBG = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: constantsBuffer, }, },
            //{ binding: 1, resource: { buffer: pixelBuffer, }, },
            { binding: 1, resource: pixelBuffer.createView() },
            { binding: 2, resource: sampler }
        ],
    });



    async function frame(elapsedMs: DOMHighResTimeStamp, main: Main) {
        // This isn't perfectly accurate (off by 1?), averaging the last 60
        // frametimes might be more precise.
        const elapsed_secs = elapsedMs / 1000
        if (elapsed_secs - main.stats_time_start > 1) {
            console.log(`fps: ${main.num_frames}`);
            main.num_frames = 0
            main.stats_time_start = elapsed_secs
        }
        main.num_frames += 1
        main.last_time = elapsed_secs


        // Write into CPU buffer, then release it
        await vertexBufferCPU.mapAsync(GPUMapMode.WRITE);

        const cpu_buffer = new Float32Array(vertexBufferCPU.getMappedRange());
        const cpu_buffer_wrapper = new BufferWrapper(cpu_buffer);

        const scene_time = (main.pause_time == 0 ? elapsed_secs : main.pause_time) - main.pause_total;
        main.scene.set_screen_size(canvas.width, canvas.height)

        //main.draw_uniform(canvas.width, canvas.height, scene_time, uniform_buffer_wrapper)
        main.scene.draw(cpu_buffer_wrapper, scene_time);

        const cpu_buffer_bytes_used = cpu_buffer_wrapper.bytes_used();

        //const num_line_segments = (uniform_buffer_wrapper.bytes_used() - 4*4) / (12*4)
        //console.log("num_line_segments: " + num_line_segments);
        //uniform_buffer[2] = Math.min(num_line_segments, 1000);

        vertexBufferCPU.unmap();
        //uniformBufferCPU.unmap();

        // GPU work starts here
        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };

        const encoder = device.createCommandEncoder();
        encoder.copyBufferToBuffer(vertexBufferCPU, 0, vertexBufferGPU, 0, cpu_buffer_bytes_used)

        const computePass = encoder.beginComputePass()
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, computeBG);
        computePass.dispatchWorkgroups(canvas.width, canvas.height, 1);
        //computePass.dispatchWorkgroups(1);
        computePass.end();

        //encoder.copyBufferToBuffer(constantsBuffer, 0, resultBuffer, 0, resultBuffer.size);

        const renderPass = encoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, fragmentBG);
        renderPass.setVertexBuffer(0, vertexBufferGPU);
        renderPass.draw(cpu_buffer_wrapper.elements_used() / 8);
        renderPass.end();

        device.queue.submit([encoder.finish()]);

        //await resultBuffer.mapAsync(GPUMapMode.READ);
        // @ts-ignore
        //const result = new Float32Array(resultBuffer.getMappedRange().slice());
        //resultBuffer.unmap();

        //console.log('input', global_constants);
        //console.log('result', result);

        requestAnimationFrame((elapsedMs) => frame(elapsedMs, main));
    }

    requestAnimationFrame((elapsedMs) => frame(elapsedMs, main));
}

var main
try {
    main = new Main()
    await init_webgpu(main)
} catch (err: any) {
    const errDiv = document.getElementById("error-message")!
    errDiv.classList.remove('hidden')
    errDiv.innerHTML = err.toString()
    throw err
}
