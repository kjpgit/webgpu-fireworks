// webgpu-fireworks Copyright (C) 2023 Karl Pickett
// All rights reserved

import * as constants from "./constants.js"
import { FPSMonitor, SceneTimer, BufferWrapper, do_throw } from "./util.js"
import { Scene } from "./fireworks.js"
import { ComputeCode } from "./compute.wgsl.js"
import { RasterizeCode } from "./rasterize.wgsl.js"
import { FragmentCode } from "./fragment.wgsl.js"
import { BinCode } from "./bin.wgsl.js"


class Main
{
    /* Troubleshooting */
    debug_max_frames = -1
    debug_show_histogram = true
    debug_max_perf_lines = 10000


    /* Internals */
    is_fullscreen = false
    last_stats_time = 0
    num_perf_lines = 0
    num_frames = 0
    scene: Scene
    scene_timer: SceneTimer
    fps_monitor: FPSMonitor

    constructor() {
        this.scene = new Scene()
        this.scene_timer = new SceneTimer()
        this.fps_monitor = new FPSMonitor()

        addEventListener("dblclick", e => this.on_double_click(e))
        addEventListener("keydown", e => this.on_keydown(e))
        addEventListener("resize", e => this.on_resize(e))
    }

    on_resize(event: Event) {
        console.log("resized")
    }

    log_perf(msg: string) {
        if (this.num_perf_lines < this.debug_max_perf_lines) {
            console.log(`[${(performance.now()/1000).toFixed(3)} s] ${msg}`)
            this.num_perf_lines += 1
        }
    }

    on_keydown(e: KeyboardEvent) {
        //console.log(`You pressed ${e.key}`)
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

    // Set internal rendering resolution
    canvas.width = constants.SCREEN_WIDTH_PX;
    canvas.height = constants.SCREEN_HEIGHT_PX;
    console.log(`internal rendering resolution is ${canvas.width} x ${canvas.height}`);
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format: presentationFormat,
        alphaMode: "opaque"
    });


    // Shaders to compile
    const rough_module = device.createShaderModule({
        label: 'rough_module', code: ComputeCode,
    });
    const fine_module = device.createShaderModule({
        label: 'fine_module', code: RasterizeCode,
    });
    const bin_module = device.createShaderModule({
        label: 'bin_module', code: BinCode,
    });
    const quad_fragment_module = device.createShaderModule({
        label: 'quad_fragment_module', code: FragmentCode,
    });


    // "Pipelines"
    const rough_pipeline = device.createComputePipeline({
        layout: 'auto', compute: { module: rough_module, entryPoint: 'rough_main', },
    });
    const bin_pipeline = device.createComputePipeline({
        layout: 'auto', compute: { module: bin_module, entryPoint: 'bin_main', },
    });
    const fine_pipeline = device.createComputePipeline({
        layout: 'auto', compute: { module: fine_module, entryPoint: 'fine_main', },
    });


    // Buffers
    const uniform_buffer_gpu = device.createBuffer({
        label: "uniform_buffer_gpu",
        size: constants.UNIFORM_BUFFER_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const rough_buffer_gpu = device.createBuffer({
        label: "rough_buffer_gpu",
        size: constants.ROUGH_BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const misc_buffer_gpu = device.createBuffer({
        label: "misc_buffer_gpu",
        size: constants.MISC_BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    const misc_buffer_cpu = device.createBuffer({
        label: "misc_buffer_cpu",
        size: constants.MISC_BUFFER_SIZE,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const fine_buffer_gpu = device.createBuffer({
        label: "fine_buffer_gpu",
        size: constants.FINE_BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE,
    });

    const output_texture_gpu = device.createBuffer({
        label: "output_texture_gpu",
        size: constants.TEXTURE_BUFFER_SIZE,
        usage: GPUBufferUsage.STORAGE,
    })


    // Texture display pipeline (simple quad vertex and fragment shader)
    const renderPipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: quad_fragment_module,
            entryPoint: "vertex_main",
        },
        fragment: {
            module: quad_fragment_module,
            entryPoint: "fragment_main",
            targets: [ { format: presentationFormat, }, ],
        },
        primitive: { topology: "triangle-list", },
    });

    const renderBG = device.createBindGroup({
        label: "renderBG",
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: output_texture_gpu, } },
        ],
    });

    const scene = main.scene

    let max_frames = 60 * 5;

    const rough_bg = device.createBindGroup({
        label: "rough_bg",
        layout: rough_pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniform_buffer_gpu } },
            { binding: 1, resource: { buffer: misc_buffer_gpu } },
            { binding: 2, resource: { buffer: rough_buffer_gpu  } },
            { binding: 3, resource: { buffer: fine_buffer_gpu } },
            //{ binding: 4, resource: { buffer: output_texture_gpu } },
        ],
    });

    const bin_bg = device.createBindGroup({
        label: "bin_bg",
        layout: bin_pipeline.getBindGroupLayout(0),
        entries: [
            //{ binding: 0, resource: { buffer: uniform_buffer_gpu } },
            { binding: 1, resource: { buffer: misc_buffer_gpu } },
            { binding: 2, resource: { buffer: fine_buffer_gpu } },
        ],
    });

    const fine_bg = device.createBindGroup({
        label: "fine_bg",
        layout: fine_pipeline.getBindGroupLayout(0),
        entries: [
            //{ binding: 0, resource: { buffer: uniform_buffer_gpu } },
            { binding: 1, resource: { buffer: misc_buffer_gpu } },
            { binding: 2, resource: { buffer: fine_buffer_gpu } },
            { binding: 3, resource: { buffer: output_texture_gpu } },
        ],
    });

    // --------------------------------
    // ANIMATION FUNCTION
    // --------------------------------
    async function frame(raw_elapsed_ms: DOMHighResTimeStamp, main: Main) {
        const raw_elapsed_secs = raw_elapsed_ms / 1000
        if (raw_elapsed_secs - main.last_stats_time > 1) {
            console.log(`[fps] cpu time:               ${main.fps_monitor.get_timing_info(0)}`);
            console.log(`[fps] get histogram results:  ${main.fps_monitor.get_timing_info(1)}`);
            console.log(`[fps] total gpu time:         ${main.fps_monitor.get_timing_info(2)}`);
            console.log(`[fps] --------------------------------------------------------------------`)
            main.last_stats_time = raw_elapsed_secs
            main.fps_monitor.clear()
        }

        // CPU Work Start -------------------------------------------------
        main.log_perf("frame start")
        const perf_cpu_start = performance.now()
        main.scene_timer.set_raw_time(raw_elapsed_secs)
        const scene_time = main.scene_timer.get_scene_time()
        scene.draw(scene_time);
        main.log_perf(`cpu drawn shapes: ${scene.num_shapes()}`)
        const perf_cpu_end = performance.now()


        // GPU Work Start -------------------------------------------------
        // Upload data and commands to GPU
        const perf_gpu_start = perf_cpu_end
        device.queue.writeBuffer(uniform_buffer_gpu, 0, scene.uniform_wrapper.bytes, 0,
                                 scene.uniform_wrapper.bytes_used)
        device.queue.writeBuffer(rough_buffer_gpu, 0, scene.firework_wrapper.bytes, 0,
                                 scene.firework_wrapper.bytes_used)
        const encoder = device.createCommandEncoder();
        encoder.clearBuffer(misc_buffer_gpu);

        const computePass = encoder.beginComputePass()

        // Physics and fine shape generation pass
        if (scene.num_shapes() > 0) {
            computePass.setPipeline(rough_pipeline);
            computePass.setBindGroup(0, rough_bg)
            computePass.dispatchWorkgroups(Math.ceil(scene.num_shapes()/constants.WG_ROUGH_THREADS))
        }

        // Binning / histogram pass
        if (scene.num_shapes() > 0) {
            computePass.setPipeline(bin_pipeline);
            computePass.setBindGroup(0, bin_bg)
            computePass.dispatchWorkgroups(Math.ceil(scene.num_shapes()/constants.WG_BIN_CHUNK_LEN))
        }

        // Rasterization pass
        if (false) {
            computePass.setPipeline(fine_pipeline);
            computePass.setBindGroup(0, fine_bg)
            const dispatch_x = Math.ceil(constants.SCREEN_WIDTH_PX / constants.WG_RASTER_PIXELS_X)
            const dispatch_y = Math.ceil(constants.SCREEN_HEIGHT_PX / constants.WG_RASTER_PIXELS_Y)
            computePass.dispatchWorkgroups(dispatch_x, dispatch_y);
        }

        computePass.end();

        // Copy the histogram results to CPU, ASAP!
        encoder.copyBufferToBuffer(misc_buffer_gpu, 0, misc_buffer_cpu, 0, 4096)

        device.queue.submit([encoder.finish()]);
        main.log_perf(`queue submitted`);

        let perf_compute_results_mapped = -1
        misc_buffer_cpu.mapAsync(GPUMapMode.READ).then(() => {
            main.log_perf(`got results back and mapped`);
            perf_compute_results_mapped = performance.now()
            const result = new Uint32Array(misc_buffer_cpu.getMappedRange());
            if (main.debug_show_histogram) {
                main.log_perf(`histogram ${main.scene.get_histogram(result)}`);
            }
            misc_buffer_cpu.unmap()
        }) // mapAsync callback end


        // GPU Work Start 2 -- Draw fullscreen quad to screen ------------
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
        const encoder2 = device.createCommandEncoder();
        const renderPass = encoder2.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, renderBG);
        renderPass.draw(6);
        renderPass.end();

        device.queue.submit([encoder2.finish()]);
        main.log_perf(`queue submitted 2`);

        device.queue.onSubmittedWorkDone().then(() => {
            main.log_perf("onSubmittedWorkDone")
            const perf_gpu_end = performance.now()
            const frame_timing = [
                perf_cpu_end - perf_cpu_start,
                perf_compute_results_mapped - perf_gpu_start,  // time to get histogram compute results from gpu
                perf_gpu_end - perf_gpu_start                  // total gpu time, including screen render
            ]
            main.fps_monitor.add_frame_timing(frame_timing)

            main.num_frames += 1
            if (main.debug_max_frames === -1 || main.num_frames < main.debug_max_frames) {
                requestAnimationFrame((raw_elapsed_ms) => frame(raw_elapsed_ms, main));
            }
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
