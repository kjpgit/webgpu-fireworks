import { SceneTimer, BufferWrapper } from "./util.js"
import { Scene } from "./fireworks.js"
import { ComputeCode } from "./compute.wgsl.js"
import { FragmentCode } from "./fragment.wgsl.js"


export function do_throw(errorMessage: string): never {
    throw new Error(errorMessage)
}


class Main
{
    readonly MAX_SEGMENT_BUFFER_SIZE = 20000000

    is_fullscreen = false
    max_segment_buffer_nr_bytes = 0
    last_stats_time = 0
    scene: Scene
    scene_timer: SceneTimer

    constructor() {
        this.scene_timer = new SceneTimer()
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
            this.scene_timer.toggle_pause()
        }
        if (e.key == "j") {
            if (this.scene_timer.is_paused()) {
                this.scene_timer.advance_pause_time(-1/60)
            }
        }
        if (e.key == "k") {
            if (this.scene_timer.is_paused()) {
                this.scene_timer.advance_pause_time(1/60)
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
    const devicePixelRatio = 1; //window.devicePixelRatio || 1;
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


    // Compute shader
    const computeModule = device.createShaderModule({
        label: 'computeModule',
        code: ComputeCode,
    });

    const computePipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: computeModule, entryPoint: 'compute_main',
        },
    });

    const global_constants = new Float32Array([
        canvas.width,
        canvas.height,
        0,  // unused,
        0,  // unused
        1, 1, 1, 1, // debug color
        99, 99, 99, 99, // fill to min buffer size
    ]);

    const constantsBuffer = device.createBuffer({
        size: global_constants.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(constantsBuffer, 0, global_constants);

    const segmentDataCPU = new Float32Array(main.MAX_SEGMENT_BUFFER_SIZE)
    const segment_data_wrapper = new BufferWrapper(segmentDataCPU)

    const segmentBufferGPU = device.createBuffer({
        size: main.MAX_SEGMENT_BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const colorTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    })

//    const resultBuffer = device.createBuffer({
//        size: global_constants.byteLength,
//        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
//    });



    // Render pipeline (simple quad vertex and fragment shader)
    const shaderModule = device.createShaderModule({
        label: 'fragmentModule',
        code: FragmentCode,
    });

    const renderPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: shaderModule,
            entryPoint: "vertex_main",
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragment_main",
            targets: [ { format: presentationFormat, }, ],
        },
        primitive: { topology: "triangle-list", },
    });


    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    const renderBG = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            //{ binding: 0, resource: { buffer: constantsBuffer, }, },
            { binding: 1, resource: colorTexture.createView() },
            { binding: 2, resource: sampler }
        ],
    });


    async function frame(raw_elapsed_ms: DOMHighResTimeStamp, main: Main) {
        const raw_elapsed_secs = raw_elapsed_ms / 1000
        if (raw_elapsed_secs - main.last_stats_time > 1) {
            console.log(`max_segment_buffer_nr_bytes: ${main.max_segment_buffer_nr_bytes}`)
            console.log(`fps: fixme`);
            main.last_stats_time = raw_elapsed_secs
            main.max_segment_buffer_nr_bytes = 0
        }


        // CPU Work Start -- timed
        const perf_cpu_start = performance.now()
        main.scene_timer.set_raw_time(raw_elapsed_secs)
        const scene_time = main.scene_timer.get_scene_time()
        segment_data_wrapper.clear();
        main.scene.set_aspect_ratio(canvas.clientWidth / canvas.clientHeight)
        main.scene.draw(segment_data_wrapper, scene_time);

        const segment_buffer_nr_bytes = segment_data_wrapper.bytes_used();
        device.queue.writeBuffer(segmentBufferGPU, 0, segmentDataCPU, 0, segment_data_wrapper.elements_used())
        if (segment_buffer_nr_bytes > main.max_segment_buffer_nr_bytes) {
            main.max_segment_buffer_nr_bytes = segment_buffer_nr_bytes
        }
        const perf_cpu_end = performance.now()


        // GPU Work Start -- timed
        const perf_gpu_start = perf_cpu_end
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
        const computePass = encoder.beginComputePass()
        computePass.setPipeline(computePipeline);

        const computeBG = device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: constantsBuffer } },
                { binding: 1, resource: { buffer: segmentBufferGPU, size: segment_buffer_nr_bytes } },
                { binding: 2, resource: colorTexture.createView() }
            ],
        });

        computePass.setBindGroup(0, computeBG);
        computePass.dispatchWorkgroups(Math.ceil(canvas.width/4), Math.ceil(canvas.height/8), 1);
        computePass.end();

        const renderPass = encoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, renderBG);
        renderPass.draw(6);
        renderPass.end();

        device.queue.submit([encoder.finish()]);
        device.queue.onSubmittedWorkDone().then(() => {
            const perf_gpu_end = performance.now()
            console.log(`cpu ${perf_cpu_end - perf_cpu_start}, gpu ${perf_gpu_end - perf_gpu_start}`)
            requestAnimationFrame((raw_elapsed_ms) => frame(raw_elapsed_ms, main));
        })
    }

    requestAnimationFrame((raw_elapsed_ms) => frame(raw_elapsed_ms, main));
}


try {
    let main = new Main()
    await init_webgpu(main)
} catch (err: any) {
    const errDiv = document.getElementById("error-message")!
    errDiv.classList.remove('hidden')
    errDiv.innerHTML = err.toString()
    throw err
}
