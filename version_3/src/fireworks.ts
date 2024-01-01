// webgpu-fireworks Copyright (C) 2023 Karl Pickett
// All rights reserved

import * as constants from "./constants.js";
import { BufferWrapper, Vector2, Color4  } from "./util.js";
import { RandomUniformUnitVector2D, smoothstep, random_range } from "./math.js";

const PERFTEST_FRAME = true


const NUM_FLARES = 20000

const LAUNCH_TIME_RANGE = [2.0, 3.0]
const LAUNCH_RANGE_X = [0.5, 0.5]
const LAUNCH_RANGE_Y = [0.5, 0.5]

const FLARE_DURATION_RANGE = [1.0, 4.0]
const FLARE_SIZE_RANGE = [0.001, 0.009]
const FLARE_COLOR_VARIANCE_RANGE = [-0.3, 0.3]

const GRAVITY = -0.04

const DEBUG_COLORS: Color4[] = [
    new Color4(1.0, 1.0, 1.0, 1.0),
    new Color4(0.0, 1.0, 0.0, 1.0),
    new Color4(0.0, 0.0, 1.0, 1.0),
]

const COLORS: Color4[] = [
    new Color4(1.0, 0.0, 0.0, 1.0),
    new Color4(0.0, 1.0, 0.0, 1.0),
    new Color4(1.0, 1.0, 0.0, 1.0),
    new Color4(0.0, 1.0, 1.0, 1.0),
    new Color4(1.0, 0.0, 0.5, 1.0),
    new Color4(1.0, 0.0, 1.0, 1.0),
    new Color4(1.0, 0.2, 0.2, 1.0),
]


function get_random_color() : Color4 {
    let i = Math.floor(random_range([0, COLORS.length]))
    return COLORS[i]
}



// A single projectile / point of light
// We record its initial parameters, so later we can (re)calculate position at
// any point in time.  Note the entire struct is immutable.
class Flare {
    readonly velocity_vec: Vector2
    readonly size: number
    readonly duration_secs: number
    readonly color: Color4

    constructor(velocity_vec: Vector2, size: number, color: Color4,
                duration_secs: number) {
        this.velocity_vec = velocity_vec
        this.size = size
        this.duration_secs = duration_secs
        this.color = color
    }
}


class Firework {
    readonly pos: Vector2
    readonly start_time: number
    readonly m_flares: Flare[]

    constructor(time: number, pos: Vector2, num_flares: number) {
        this.start_time = time
        this.pos = pos;
        this.m_flares = new Array()
        this.add_flares(num_flares)
    }

    add_flares(num_flares: number) {
        let orig_color = get_random_color()
        for (let i = 0; i < num_flares; i++) {
            let velocity = RandomUniformUnitVector2D()

            // color variance
            let color = orig_color.clone()
            color.r += random_range(FLARE_COLOR_VARIANCE_RANGE)
            color.b += random_range(FLARE_COLOR_VARIANCE_RANGE)
            color.g += random_range(FLARE_COLOR_VARIANCE_RANGE)
            //color.a = random_range(0.7, 4.0)

            // other variance
            const duration_secs = random_range(FLARE_DURATION_RANGE)
            const size = random_range(FLARE_SIZE_RANGE)

            let f = new Flare(velocity, size, color, duration_secs)
            this.m_flares.push(f)
        }
    }
}


export class Scene
{
    private fireworks: Firework[] = new Array()
    private next_launch = 0

    uniform_wrapper = new BufferWrapper(constants.UNIFORM_BUFFER_SIZE)
    firework_wrapper = new BufferWrapper(constants.ROUGH_BUFFER_SIZE)

    constructor() { }

    num_shapes() { return this.firework_wrapper.bytes_used / 48; }

    draw(current_time: number)
    {
        this.uniform_wrapper.clear();
        this.firework_wrapper.clear();

        // Rough perf testing, not an exact science
        if (PERFTEST_FRAME) {
            if (this.fireworks.length == 0) {
                if (true) {
                    let pos: Vector2
                    let fw: Firework

                    pos = new Vector2(0.10, 0.9)
                    fw = new Firework(0, pos, NUM_FLARES)
                    this.fireworks.push(fw)

                    pos = new Vector2(0.5, 0.5)
                    fw = new Firework(0, pos, NUM_FLARES)
                    this.fireworks.push(fw)
                }
            }
            current_time = 1 * 1/60
            current_time = 1 * 30/60
            //current_time = 1 * 50/60
            //current_time /= 10000
        } else {
            // Normal auto launch
            if (current_time > this.next_launch && this.fireworks.length >= 0) {
                this.launch_firework(current_time)
                this.next_launch = current_time + random_range(LAUNCH_TIME_RANGE)
            }
        }


        for (const fw of this.fireworks) {
            this.write_firework(fw)
        }
        this.write_uniform(current_time)
    }

    private launch_firework(current_time: number) {
        const pos_x = random_range(LAUNCH_RANGE_X)
        const pos_y = random_range(LAUNCH_RANGE_Y)
        let pos = new Vector2(pos_x, pos_y)

        let fw = new Firework(current_time, pos, NUM_FLARES)
        this.fireworks.push(fw)
        while (this.fireworks.length > 5) {
            this.fireworks.shift()
        }
    }

    private write_uniform(current_time: number) {
        this.uniform_wrapper.append_raw_f32(current_time)
        this.uniform_wrapper.append_raw_u32(0)
        this.uniform_wrapper.append_raw_u32(this.num_shapes())
        this.uniform_wrapper.set_min_size()
    }

    private write_firework(fw: Firework) {
        for (const flare of fw.m_flares) {
            this.firework_wrapper.append_raw_f32(fw.pos.x)
            this.firework_wrapper.append_raw_f32(fw.pos.y)
            this.firework_wrapper.append_raw_f32(flare.velocity_vec.x)
            this.firework_wrapper.append_raw_f32(flare.velocity_vec.y)

            this.firework_wrapper.append_raw_f32(flare.size)
            this.firework_wrapper.append_raw_f32(fw.start_time)
            this.firework_wrapper.append_raw_f32(flare.duration_secs)
            this.firework_wrapper.append_raw_f32(999)

            this.firework_wrapper.append_raw_color4(flare.color)
        }
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


