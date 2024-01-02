// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

import * as constants from "./constants.js";
import { BufferWrapper, Vector2, Vector3, Color4  } from "./util.js";
import { RandomUniformUnitVector3D, smoothstep, random_range } from "./math.js";

const PERFTEST_FRAME = 0
const PERFTEST_PAGE = 0


const NUM_FLARES = 100
const MAX_FIREWORKS = 1

const LAUNCH_TIME_RANGE = [200.2, 300.0]
const LAUNCH_RANGE_X = [0.5, 0.5]
const LAUNCH_RANGE_Y = [0.8, 0.8]

const FLARE_DURATION_RANGE = [100.0, 400.0]
const FLARE_SIZE_RANGE = [0.005, 0.005]  // this is really a radius
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
    readonly velocity_vec: Vector3
    readonly size: number
    readonly duration_secs: number
    readonly color: Color4

    constructor(velocity_vec: Vector3, size: number, color: Color4,
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
            let velocity = RandomUniformUnitVector3D()

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

    scene_number = 0
    debug_flags = 0
    uniform_wrapper = new BufferWrapper(constants.UNIFORM_BUFFER_SIZE)
    firework_wrapper = new BufferWrapper(constants.ROUGH_BUFFER_SIZE)

    constructor() { }

    num_shapes() { return this.firework_wrapper.bytes_used / 48; }

    draw(current_time: number)
    {
        this.uniform_wrapper.clear();
        this.firework_wrapper.clear();

        if (this.scene_number == 2) {
            this.draw_test_page()
            this.write_uniform(current_time)
            return;
        } else if (this.scene_number == 3) {
            this.draw_test_page2()
            this.write_uniform(current_time)
            return;
        }

        // Rough perf testing, not an exact science
        if (PERFTEST_FRAME > 0) {
            if (this.fireworks.length == 0) {
                if (true) {
                    let pos: Vector2
                    let fw: Firework

                    pos = new Vector2(0.10, 0.9)
                    fw = new Firework(0, pos, NUM_FLARES)
                    //fw = new Firework(48/60, pos, NUM_FLARES)
                    this.fireworks.push(fw)

                    pos = new Vector2(0.5, 0.5)
                    fw = new Firework(0, pos, NUM_FLARES)
                    this.fireworks.push(fw)
                }
            }
            current_time = 0 * 1/60
            //current_time = 1 * 50/60
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

        this.draw_test_dot(new Vector2(0.5,0.5), 0.01, new Color4(1,0,0,0))
        this.draw_test_dot(new Vector2(0.5,0.4), 0.01, new Color4(1,1,0,0), constants.SHAPE_FLAG_ROTATE,
                          new Vector3(0.0, 0.0, 0.0))
        this.draw_test_dot(new Vector2(0.5,0.3), 0.01, new Color4(1,1,1,0), constants.SHAPE_FLAG_ROTATE,
                          new Vector3(0.5, 0.0, 0.0))
        this.draw_test_dot(new Vector2(0.5,0.2), 0.01, new Color4(0,1,1,0), constants.SHAPE_FLAG_ROTATE,
                          new Vector3(1.0, 0.0, 0.0))

        this.write_uniform(current_time)
    }

    toggle_debug(flag: number) {
        if ((this.debug_flags & flag) != 0) {
            // already set, unset it
            this.debug_flags &= ~flag;
        } else {
            this.debug_flags |= flag;
        }
    }

    private launch_firework(current_time: number) {
        const pos_x = random_range(LAUNCH_RANGE_X)
        const pos_y = random_range(LAUNCH_RANGE_Y)
        let pos = new Vector2(pos_x, pos_y)

        let fw = new Firework(current_time, pos, NUM_FLARES)
        this.fireworks.push(fw)
        while (this.fireworks.length > MAX_FIREWORKS) {
            this.fireworks.shift()
        }
    }

    private write_uniform(current_time: number) {
        this.uniform_wrapper.append_raw_f32(current_time)
        this.uniform_wrapper.append_raw_u32(this.debug_flags)
        this.uniform_wrapper.append_raw_u32(this.num_shapes())
        this.uniform_wrapper.set_min_size()
    }

    private write_firework(fw: Firework) {
        for (const flare of fw.m_flares) {
            this.firework_wrapper.append_raw_f32(fw.pos.x)
            this.firework_wrapper.append_raw_f32(fw.pos.y)
            this.firework_wrapper.append_raw_f32(0.5)
            this.firework_wrapper.append_raw_f32(999)  // padding

            this.firework_wrapper.append_raw_f32(flare.velocity_vec.x)
            this.firework_wrapper.append_raw_f32(flare.velocity_vec.y)
            this.firework_wrapper.append_raw_f32(flare.velocity_vec.z)
            this.firework_wrapper.append_raw_f32(999)  // padding

            this.firework_wrapper.append_raw_f32(flare.size)
            this.firework_wrapper.append_raw_f32(fw.start_time)
            this.firework_wrapper.append_raw_f32(flare.duration_secs)
            let flags = 0;
            //flags |= constants.SHAPE_FLAG_GRAVITY
            flags |= constants.SHAPE_FLAG_ROTATE
            flags |= constants.SHAPE_FLAG_EXPLODE
            this.firework_wrapper.append_raw_u32(flags)

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

    // 10,000 little dots, so pretty
    // Getting 30fps starting 10k branch
    draw_test_page() {
        for (var x = 0; x < 200; x++) {
            for (var y = 0; y < 50; y++) {
                let color = new Color4(0.0, 0.0, 0.0, 0.0);
                //let color = get_random_color();
                color.b = 1;
                if (x % 10 == 0) {
                    color.r = 1;
                }
                if (y % 10 == 0 || x == 100) {
                    color.r = 0;
                    color.g = 1;
                }
                let wx = (x + 0.5) / 200
                let wy = (y + 0.5) / 50
                this.draw_test_dot(new Vector2(wx, wy), 0.0025, color)
            }
        }
    }

    // Shows our tile layout
    draw_test_page2() {
        for (var x = 0; x < constants.NUM_TILES_X; x++) {
            for (var y = 0; y < constants.NUM_TILES_Y; y++) {
                // If only we could draw a line :)
                // Draw corners for now
                let wx = (x + 0.0) / constants.NUM_TILES_X
                let wy = (y + 0.0) / constants.NUM_TILES_Y
                let color = new Color4(0.0, 0.0, 0.0, 0.0);
                color.b = 1;
                this.draw_test_dot(new Vector2(wx, wy), 0.0010, color)
            }
        }
    }


    draw_test_dot(world_pos: Vector2, world_radius: number, color: Color4,
                  flags?: number, velocity?: Vector3) {
        this.firework_wrapper.append_raw_f32(world_pos.x)
        this.firework_wrapper.append_raw_f32(world_pos.y)
        this.firework_wrapper.append_raw_f32(0.5)
        this.firework_wrapper.append_raw_f32(999)  // padding

        if (velocity !== undefined) {
            this.firework_wrapper.append_raw_f32(velocity.x)
            this.firework_wrapper.append_raw_f32(velocity.y)
            this.firework_wrapper.append_raw_f32(velocity.z)
        } else {
            this.firework_wrapper.append_raw_f32(0)
            this.firework_wrapper.append_raw_f32(0)
            this.firework_wrapper.append_raw_f32(0)
        }
        this.firework_wrapper.append_raw_f32(999)  // padding

        this.firework_wrapper.append_raw_f32(world_radius)
        this.firework_wrapper.append_raw_f32(0)    // start time
        this.firework_wrapper.append_raw_f32(999999)    // duration
        if (typeof flags !== "undefined") {
            console.log("wtf defined:" + flags);
            this.firework_wrapper.append_raw_u32(flags)
        } else {
            console.log("wtf2 undefined:" + flags);
            this.firework_wrapper.append_raw_u32(0)
        }

        this.firework_wrapper.append_raw_color4(color)
    }
}


