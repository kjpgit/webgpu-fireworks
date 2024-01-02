// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

import * as constants from "./constants.js";
import { BufferWrapper } from "./util.js";
import { FireworksScene } from "./fireworks.js";
import { DebugScene1 } from "./debug.js";
import { DebugScene2 } from "./debug.js";
import { DebugScene3 } from "./debug.js";


export interface Scene {
    draw(engine: Engine): void
}


export class Engine
{
    scene_list: Scene[] = []
    current_time: number = 0
    scene_number = 0
    debug_flags = 0
    uniform_wrapper = new BufferWrapper(constants.UNIFORM_BUFFER_SIZE)
    rough_wrapper = new BufferWrapper(constants.ROUGH_BUFFER_SIZE)

    constructor() {
        this.scene_list[0] = new FireworksScene()
        this.scene_list[1] = new DebugScene1()
        this.scene_list[2] = new DebugScene2()
        this.scene_list[3] = new DebugScene3()
        //this.scene_list[4] = new DebugScene4()
    }

    num_shapes() { return this.rough_wrapper.bytes_used / constants.ROUGH_SHAPE_SIZE; }

    draw(current_time: number) {
        this.uniform_wrapper.clear();
        this.rough_wrapper.clear();
        this.current_time = current_time
        this.scene_list[this.scene_number].draw(this)
        this.write_uniform(this.current_time)  // let scene override the time
    }

    toggle_debug(flag: number) {
        if ((this.debug_flags & flag) != 0) {
            // already set, unset it
            this.debug_flags &= ~flag;
        } else {
            this.debug_flags |= flag;
        }
    }

    private write_uniform(current_time: number) {
        this.uniform_wrapper.append_raw_f32(current_time)
        this.uniform_wrapper.append_raw_u32(this.debug_flags)
        this.uniform_wrapper.append_raw_u32(this.num_shapes())
        this.uniform_wrapper.set_min_size()
    }

    get_histogram(misc_data: Uint32Array) : string {
        let total_shapes = misc_data[0]
        let shapes_per_row = misc_data.slice(32/4,32/4 + 8)
        let tile_array = misc_data.slice(128/4, 128/4 + 8*8)
        //console.log(tile_array);

        let hist = ""
        hist += `------------------- \n`
        let total_blends = 0
        for (var y = 0; y < 8; y++) {
            hist += `row ${y}: (${shapes_per_row[y].toString().padStart(5, " ")})    | `
            for (var x = 0; x < 8; x++) {
                let num = tile_array[x + y*8]
                total_blends += num
                hist += ` ${num.toString().padStart(5, " ")} `
            }
            hist += "  | \n"
        }
        hist += `total_shapes = ${total_shapes}\n`
        hist += `total_blends = ${total_blends}\n`
        //hist += `raw: ${misc_data.slice(0, 256)}`
        //hist += "\n"
        return hist
    }
}


export class SceneTimer {
    private raw_time: number
    private raw_pause_start: number
    private raw_pause_accumulated: number

    constructor() {
        this.raw_time = 0
        this.raw_pause_start = -1
        this.raw_pause_accumulated = 0
    }

    toggle_pause() {
        if (this.raw_pause_start < 0) {
            // Pause
            this.raw_pause_start = this.raw_time
        } else {
            // Unpause
            this.raw_pause_accumulated += (this.raw_time - this.raw_pause_start)
            this.raw_pause_start = -1
        }
    }

    is_paused(): boolean {
        return this.raw_pause_start >= 0
    }

    advance_pause_time(secs: number) {
        this.raw_pause_start += secs
        // Don't allow pre-history
        this.raw_pause_start = Math.max(this.raw_pause_start, 0)
    }

    set_raw_time(raw_secs: number) {
        this.raw_time = raw_secs
    }

    get_scene_time(): number {
        return (this.raw_pause_start <= 0 ? this.raw_time : this.raw_pause_start) - this.raw_pause_accumulated;
    }
}


export class FPSMonitor {
    frame_data: number[][] = []

    add_frame_timing(frame_data: number[]) {
        this.frame_data.push(frame_data)
    }

    clear() {
        this.frame_data = []
    }

    get_timing_info(index: number): string {
        let vals: number[] = []
        for (const frame of this.frame_data) {
            vals.push(frame[index])
        }
        const sum = vals.reduce((a,b) => a + b, 0)
        const avg = (sum / vals.length).toFixed(2)
        const max = Math.max(...vals).toFixed(2)
        return `avg: ${avg} ms, max: ${max} ms`
    }
}

