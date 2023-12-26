import { BufferWrapper, Vector2, Color4  } from "./buffer.js";
import { RandomUniformUnitVector2D, smoothstep, random_range } from "./math.js";


const NUM_FLARES = 400
const WORKGROUP_SIZE_X = 128
const WORKGROUP_SIZE_Y = 64

const LAUNCH_TIME_RANGE = [0.3, 1.7]
const LAUNCH_RANGE_X = [0.2, 0.8]
const LAUNCH_RANGE_Y = [0.5, 0.9]
const FLARE_VELOCITY_RANGE = [0.1, 0.2]  // fixme: this doesn't make much sense
const FLARE_DURATION_RANGE = [1.0, 4.0]
//const FLARE_TRAIL_TIME_RANGE = [0.3, 0.7]
const FLARE_SIZE_RANGE = [0.003, 0.007]
const FLARE_COLOR_VARIANCE_RANGE = [-0.3, 0.3]
const FLARE_GRAVITY_VARIANCE_RANGE = [0.8, 1.2]
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

function is_onscreen(position: Vector2): boolean {
    // todo: include size
    return (Math.min(position.x, position.y) >= 0 && Math.max(position.y, position.y) < 1)
}

function get_workgroup_index_x(x: number): number {
    return Math.min(WORKGROUP_SIZE_X-1, Math.max(0, Math.floor(x * WORKGROUP_SIZE_X)))
}

function get_workgroup_index_y(y: number): number {
    return Math.min(WORKGROUP_SIZE_Y-1, Math.max(0, Math.floor(y * WORKGROUP_SIZE_Y)))
}

function get_workgroup_index(index_x: number, index_y: number): number {
    return index_x + (index_y * WORKGROUP_SIZE_X);
}


// Return distance traveled due to initial explosion force
// Simulate air drag - velocity tapers off exponentially
function _get_flight(vel: number, secs: number) : number {
    let t = Math.log10(1 + secs * 10.0)
    return t * vel
}

class RenderPoint {
    readonly position: Vector2
    readonly size: number
    readonly color: Color4

    constructor(position: Vector2, size: number, color: Color4) {
        this.position = position
        this.size = size
        this.color = color
    }

    get_workgroups(): number[] {
        let ret = []
        //const x_mid = get_workgroup_index_x(this.position.x)
        //const y_mid = get_workgroup_index_y(this.position.y)
        //ret.push(get_workgroup_index(x_mid, y_mid))
        const x_min = get_workgroup_index_x(this.position.x - this.size)
        const x_max = get_workgroup_index_x(this.position.x + this.size)
        const y_min = get_workgroup_index_y(this.position.y - this.size)
        const y_max = get_workgroup_index_y(this.position.y + this.size)
        for (var x = x_min; x <= x_max; x++) {
            for (var y = y_min; y <= y_max; y++) {
                ret.push(get_workgroup_index(x,y))
            }
        }
        //console.log("point workgroups: " + ret)
        return ret
    }
}


// A single projectile / point of light
// We record its initial parameters, so later we can (re)calculate position at
// any point in time.  Note the entire struct is immutable.
class Flare {
    readonly velocity_vec: Vector2
    readonly size: number
    readonly color: Color4

    // How long the light lasts
    readonly duration_secs: number

    // How far back the trail goes (plume mode)
    readonly trail_secs: number
    readonly gravity: number

    constructor(velocity_vec: Vector2, size: number, color: Color4,
                duration_secs: number, trail_secs: number) {
        this.velocity_vec = velocity_vec
        this.size = size
        this.color = color
        this.duration_secs = duration_secs
        this.trail_secs = trail_secs
        this.gravity = random_range(FLARE_GRAVITY_VARIANCE_RANGE)
    }

    public pointAtTime(secs: number, orig_pos: Vector2, aspect_ratio: number) : Vector2 {
        let ret = orig_pos.clone();
        ret.x += _get_flight(this.velocity_vec.x, secs) * aspect_ratio
        ret.y += _get_flight(this.velocity_vec.y, secs)
        //ret.z += _get_flight(velocity_vec.z, secs: secs)

        // Gravity
        ret.y += (GRAVITY * secs * secs * this.gravity)

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
    readonly pos: Vector2
    readonly start_time: number
    readonly type: number
    readonly m_flares: Flare[]

    // Create a random firework
    constructor(time: number) {
        const pos_x = random_range(LAUNCH_RANGE_X)
        const pos_y = random_range(LAUNCH_RANGE_Y)

        this.pos = new Vector2(pos_x, pos_y)
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

    draw(time: number, aspect_ratio: number, points: RenderPoint[]) {
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
                this.render_flare_trail(flare, secs, points, aspect_ratio)
            }
        }
    }

    private render_flare_simple(flare: Flare, secs: number, points: BufferWrapper)
    {
        if (secs > flare.duration_secs) {
            return
        }
        let p = flare.pointAtTime(secs, this.pos, 1.9)
        let color = flare.colorAtTime(secs)
        if (secs > (flare.duration_secs - 0.1)) {
            // flash out
            color.a = 1.0
        }
        let size = flare.size
        //draw_triangle_2d(buffer, p, size, size, color)
        //draw_triangle_2d(buffer, p, size, -size, color)
    }


    private render_flare_trail(flare: Flare, secs: number, points: RenderPoint[], aspect_ratio: number)
    {
        if (secs > flare.duration_secs) {
            return
        }

        let size = flare.size;
        let end_position = flare.pointAtTime(secs, this.pos, aspect_ratio)
        let end_color = flare.colorAtTime(secs)

        let start_time = Math.max(secs - flare.trail_secs, 0)
        let start_position = flare.pointAtTime(start_time, this.pos, aspect_ratio)
        let start_color = flare.colorAtTime(start_time)

        if (is_onscreen(end_position)) {
            points.push(new RenderPoint(end_position, size, end_color))
        }
        if (is_onscreen(start_position)) {
            points.push(new RenderPoint(start_position, size, start_color))
        }

        //buffer.append_raw(end_position.x)
        //buffer.append_raw(end_position.y)
        //buffer.append_raw(size);
        //buffer.append_raw(0.0);
        //buffer.append_raw_color4(end_color)

        //buffer.append_raw(start_position.x)
        //buffer.append_raw(start_position.y)
        //buffer.append_raw(size);
        //buffer.append_raw(0.0);
        //buffer.append_raw_color4(start_color)
    }
}



export class Scene
{
    private m_fireworks: Firework[]
    private next_launch: number = 0
    private next_stats: number = 0
    private stats_max_buffer: number = 0
    private x_aspect_ratio: number = 0
    private workgroup_data: RenderPoint[][] = []

    constructor() {
        this.m_fireworks = new Array();
        this.next_launch = 0;

        this.workgroup_data = new Array(WORKGROUP_SIZE_X * WORKGROUP_SIZE_Y)
    }

    set_screen_size(width: number, height: number) {
        this.x_aspect_ratio = height / width
    }

    draw(buffer: BufferWrapper, time: number)
    {
        //time = Math.floor(time * 60) / 60
        //console.log(time)

        if (time > this.next_launch) {
            this.launch_firework(time)
            this.next_launch = time + random_range(LAUNCH_TIME_RANGE)
        }

        var points: RenderPoint[] = []
        for (const fw of this.m_fireworks) {
            fw.draw(time, this.x_aspect_ratio, points)
        }

        // Bin points into WORKGROUP_SIZE buckets - O(N)
        for (var i = 0; i < this.workgroup_data.length; i++) {
            this.workgroup_data[i] = []
        }
        for (const point of points) {
            for (const workgroup_id of point.get_workgroups()) {
                this.workgroup_data[workgroup_id].push(point)
            }
        }

        // Write index
        var idx_start = 0;
        for (var w = 0; w < this.workgroup_data.length; w++) {
            var workgroup_len = this.workgroup_data[w].length;
            //console.log(`workgroup ${w} ${idx_start} len=${workgroup_len}`);
            buffer.append_raw(idx_start);
            buffer.append_raw(workgroup_len);
            idx_start += workgroup_len;
        }

        // Write data
        for (var w = 0; w < this.workgroup_data.length; w++) {
            for (const point of this.workgroup_data[w]) {
                buffer.append_raw(point.position.x)
                buffer.append_raw(point.position.y)
                buffer.append_raw(point.size);
                buffer.append_raw(0.0);
                buffer.append_raw_color4(point.color)
            }
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


