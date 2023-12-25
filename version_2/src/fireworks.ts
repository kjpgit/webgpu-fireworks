import { BufferWrapper, Vector3, Color4  } from "./buffer.js";
import { RandomUniformUnitVector2D, smoothstep, random_range } from "./math.js";


const LAUNCH_TIME_RANGE = [2.1, 2.7]
const NUM_FLARES = 100
const FLARE_VELOCITY_RANGE = [0.3, 0.5]  // fixme: this doesn't make much sense
const FLARE_DURATION_RANGE = [1.0, 4.0]
//const FLARE_TRAIL_TIME_RANGE = [0.3, 0.7]
const FLARE_SIZE_RANGE = [0.005, 0.019]
const FLARE_COLOR_VARIANCE_RANGE = [-0.3, 0.3]
const FLARE_TRAIL_STEP_SECS = 1/60
const GRAVITY = -0.04

const DEBUG_COLORS: Color4[] = [
    new Color4(1.0, 0.0, 0.0, 1.0),
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


// Return distance traveled due to initial explosion force
// Simulate air drag - velocity tapers off exponentially
function _get_flight(vel: number, secs: number) : number {
    let t = Math.log10(1 + secs * 10.0)
    return t * vel
}



// A single projectile / point of light
// We record its initial parameters, so later we can (re)calculate position at
// any point in time.  Note the entire struct is immutable.
class Flare {
    readonly velocity_vec: Vector3
    readonly size: number
    readonly color: Color4

    // How long the light lasts
    readonly duration_secs: number

    // How far back the trail goes (plume mode)
    readonly trail_secs: number

    constructor(velocity_vec: Vector3, size: number, color: Color4,
                duration_secs: number, trail_secs: number) {
        this.velocity_vec = velocity_vec
        this.size = size
        this.color = color
        this.duration_secs = duration_secs
        this.trail_secs = trail_secs
    }

    public pointAtTime(secs: number, orig_pos: Vector3) : Vector3 {
        let ret = orig_pos.clone();
        ret.x += _get_flight(this.velocity_vec.x, secs)
        ret.y += _get_flight(this.velocity_vec.y, secs)
        //ret.z += _get_flight(velocity_vec.z, secs: secs)

        // Gravity
        ret.y += (GRAVITY * secs * secs)

        return ret
    }

    public colorAtTime(secs: number) : Color4 {
        // Linear fade out is fine.  Note we can start with a > 1.0,
        // so it actually appears exponential.
        let ret = this.color.clone()
        let percent = secs / this.duration_secs  // 0 - 1
        let factor = smoothstep(0, 1, 1-percent)
        ret.a *= factor
        return ret
    }
}


class Firework {
    readonly pos: Vector3
    readonly start_time: number
    readonly type: number
    readonly m_flares: Flare[]

    // Create a random firework
    constructor(time: number) {
        const pos_x = random_range([-0.8, 0.8])
        const pos_y = random_range([0.0, 0.8])

        // It's cool to set this at -0.2 and see the fireworks as they pop
        // through the back plane (if you also enable z velocity)
        const pos_z = 0.1

        this.pos = new Vector3(pos_x, pos_y, pos_z)
        this.type = Math.floor(random_range([0, 2]))
        this.type = 1;
        this.start_time = time
        this.m_flares = new Array()
        this.add_flares(NUM_FLARES)
    }

    add_flares(num_flares: number) {
        let orig_color = get_random_color()

        // Reserve exact storage space.  It saves a bit of wasted memory.
        //m_flares.reserveCapacity(count)

        for (let i = 0; i < num_flares; i++) {
            let velocity = RandomUniformUnitVector2D()
            let speed = random_range(FLARE_VELOCITY_RANGE)
            velocity.x *= speed
            velocity.y *= speed

            // color variance
            let color = orig_color.clone()
            color.r += random_range(FLARE_COLOR_VARIANCE_RANGE)
            color.b += random_range(FLARE_COLOR_VARIANCE_RANGE)
            color.g += random_range(FLARE_COLOR_VARIANCE_RANGE)
            //color.a = random_range(0.7, 4.0)

            // other variance
            const duration_secs = random_range(FLARE_DURATION_RANGE)
            const size = random_range(FLARE_SIZE_RANGE)
            //let trail_secs = random_range(FLARE_TRAIL_TIME_RANGE)
            const trail_secs = size * 10;

            let f = new Flare(velocity, size, color, duration_secs, trail_secs)
            this.m_flares.push(f)
        }
    }

    getSecondsElapsed(time: number) : number {
        if (time < this.start_time) {
            return 0
        }
        return (time - this.start_time)
    }

    draw(time: number, aspect_ratio: number, buffer: BufferWrapper) {
        let secs = this.getSecondsElapsed(time)
        //console.log(`num_flares ${this.m_flares.length} secs ${secs}`)
        if (this.type == 0) {
            // classic particle only
            for (const flare of this.m_flares) {
                //console.log(`flare velocity_vec ${flare.velocity_vec.toString()}`)
                //this.render_flare_simple(flare, secs, buffer)
            }
        } else {
            // long trail
            for (const flare of this.m_flares) {
                this.render_flare_trail(flare, secs, buffer, aspect_ratio)
            }
        }
    }

    private render_flare_simple(flare: Flare, secs: number, buffer: BufferWrapper)
    {
        if (secs > flare.duration_secs) {
            return
        }
        let p = flare.pointAtTime(secs, this.pos)
        let color = flare.colorAtTime(secs)
        if (secs > (flare.duration_secs - 0.1)) {
            // flash out
            color.a = 1.0
        }
        let size = flare.size
        draw_triangle_2d(buffer, p, size, size, color)
        draw_triangle_2d(buffer, p, size, -size, color)
    }


    private render_flare_trail(flare: Flare, secs: number, buffer: BufferWrapper, aspect_ratio: number)
    {
        let local_secs = secs
        if (local_secs > flare.duration_secs) {
            return
        }

        let nr_segments = 0;
        let trail_secs = 0
        let size = flare.size;

        while (local_secs >= 0 && trail_secs <= flare.trail_secs) {
            let position = flare.pointAtTime(local_secs, this.pos)
            let color = flare.colorAtTime(local_secs)
            position.x *= aspect_ratio;

            buffer.append_raw(position.x)
            buffer.append_raw(position.y)
            buffer.append_raw(size);
            buffer.append_raw(0.0);
            buffer.append_raw_color4(color)

            // todo: make point smaller at end

            size *= 0.95
            color.a *= 0.9;

            // go to previous particle on trail
            local_secs -= FLARE_TRAIL_STEP_SECS
            trail_secs += FLARE_TRAIL_STEP_SECS
        }
    }
}


function draw_triangle_2d(b: BufferWrapper, pos: Vector3, width: number, height: number, color: Color4) {
    if (!b.has_available(3*8)) {
        return
    }

    b.append_raw(pos.x - width)
    b.append_raw(pos.y)
    b.append_raw(pos.z)
    b.append_raw(1.0)
    b.append_raw_color4(color)

    b.append_raw(pos.x + width)
    b.append_raw(pos.y)
    b.append_raw(pos.z)
    b.append_raw(1.0)
    b.append_raw_color4(color)

    b.append_raw(pos.x)
    b.append_raw(pos.y + height)
    b.append_raw(pos.z)
    b.append_raw(1.0)
    b.append_raw_color4(color)
}


export class Scene
{
    private m_fireworks: Firework[]
    private next_launch: number = 0
    private next_stats: number = 0
    private stats_max_buffer: number = 0
    private x_aspect_ratio: number = 0

    constructor() {
        this.m_fireworks = new Array();
        this.next_launch = 0.3;
    }

    set_screen_size(width: number, height: number) {
        this.x_aspect_ratio = height / width
    }

    draw(buffer: BufferWrapper, time: number)
    {
        time = Math.floor(time * 60) / 60
        //console.log(time)

        if (time > this.next_launch) {
            this.launch_firework(time)
            this.next_launch = time + random_range(LAUNCH_TIME_RANGE)
        }

        for (const fw of this.m_fireworks) {
            fw.draw(time, this.x_aspect_ratio, buffer)
        }

        if (buffer.bytes_used() > this.stats_max_buffer) {
            this.stats_max_buffer = buffer.bytes_used()
        }

        if (this.next_stats < time) {
            console.log(`stats_max_buffer: ${this.stats_max_buffer}`)
            this.next_stats = time + 1.0
            this.stats_max_buffer = 0
        }
    }

    private launch_firework(current_time: number) {
        let fw = new Firework(current_time)
        this.m_fireworks.push(fw)
        while (this.m_fireworks.length > 10) {
            this.m_fireworks.shift()
        }
    }
}


