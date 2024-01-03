// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

import * as constants from "./constants.js";
import { type Scene, Engine } from "./engine.js";
import { Vector2, Vector3, Color4  } from "./util.js";
import { RandomUniformUnitVector3D, smoothstep, random_range } from "./math.js";

const NUM_FLARES = 1000
const MAX_FIREWORKS = 2
const HOLD_FIREWORK = 1

const LAUNCH_TIME_RANGE = [50.0, 50.0]
const LAUNCH_RANGE_X = [0.5, 0.5]
const LAUNCH_RANGE_Y = [0.5, 0.5]

const FLARE_DURATION_RANGE = [40.0, 50.0]
const FLARE_SIZE_RANGE = [0.005, 0.005]  // this is really a radius
const FLARE_COLOR_VARIANCE_RANGE = [-0.3, 0.3]
const FLARE_VELOCITY_VARIANCE_RANGE = [1.0, 10.5]

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
            let velocity_variance = random_range(FLARE_VELOCITY_VARIANCE_RANGE)
            velocity.x *= velocity_variance;
            velocity.y *= velocity_variance;
            velocity.z *= velocity_variance;

            // color variance
            let color = orig_color.clone()
            color.r += random_range(FLARE_COLOR_VARIANCE_RANGE)
            color.b += random_range(FLARE_COLOR_VARIANCE_RANGE)
            color.g += random_range(FLARE_COLOR_VARIANCE_RANGE)
            //color.a = random_range(0.7, 4.0)

            // other variance
            let duration_secs = 999999
            if (!HOLD_FIREWORK) {
                duration_secs = random_range(FLARE_DURATION_RANGE)
            }
            const size = random_range(FLARE_SIZE_RANGE)

            let f = new Flare(velocity, size, color, duration_secs)
            this.m_flares.push(f)
        }
    }
}


export class FireworksScene implements Scene
{
    private fireworks: Firework[] = new Array()
    private next_launch = 0

    constructor() { }

    draw(engine: Engine) {
        // Auto launch
        let current_time = engine.current_time
        if (current_time > this.next_launch && this.fireworks.length >= 0) {
            if (this.fireworks.length == 0 || !HOLD_FIREWORK) {
                this.launch_firework(current_time)
                this.next_launch = current_time + random_range(LAUNCH_TIME_RANGE)
            }
        }

        for (const fw of this.fireworks) {
            this.write_firework(engine, fw)
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

    private write_firework(engine: Engine, fw: Firework) {
        for (const flare of fw.m_flares) {
            engine.rough_wrapper.append_raw_f32(fw.pos.x)
            engine.rough_wrapper.append_raw_f32(fw.pos.y)
            engine.rough_wrapper.append_raw_f32(0.5) // z
            engine.rough_wrapper.append_raw_f32(999)  // padding

            engine.rough_wrapper.append_raw_f32(flare.velocity_vec.x)
            engine.rough_wrapper.append_raw_f32(flare.velocity_vec.y)
            engine.rough_wrapper.append_raw_f32(flare.velocity_vec.z)
            engine.rough_wrapper.append_raw_f32(999)  // padding

            engine.rough_wrapper.append_raw_f32(flare.size)
            engine.rough_wrapper.append_raw_f32(fw.start_time)
            engine.rough_wrapper.append_raw_f32(flare.duration_secs)
            let flags = 0;
            //flags |= constants.SHAPE_FLAG_GRAVITY
            flags |= constants.SHAPE_FLAG_ROTATE
            flags |= constants.SHAPE_FLAG_EXPLODE
            engine.rough_wrapper.append_raw_u32(flags)

            engine.rough_wrapper.append_raw_color4(flare.color)
        }
    }

}


