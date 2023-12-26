// NB: Writing past a TypedArray's max size does not throw any error,
// the write is simply ignored.
export class BufferWrapper {
    private buffer: Float32Array
    private max_elements: number
    private nr_elements: number

    constructor(buffer: Float32Array) {
      this.buffer = buffer
      this.max_elements = buffer.length
      this.nr_elements = 0
    }

    clear() {
        this.nr_elements = 0;
    }

    bytes_used(): number {
        return this.nr_elements * 4;
    }

    elements_used(): number {
        return this.nr_elements;
    }

    available(): number {
        return (this.max_elements - this.nr_elements)
    }

    has_available(elements: number): boolean {
        return this.available() >= elements
    }

    append_raw_color4(v: Color4) {
        this.append_raw(v.r)
        this.append_raw(v.g)
        this.append_raw(v.b)
        this.append_raw(v.a)
    }

    // No capacity checks; caller must check beforehand
    append_raw(v: number) {
        this.buffer[this.nr_elements] = v;
        this.nr_elements += 1;
    }
}


export class Vector3 {
    x: number = 0
    y: number = 0
    z: number = 0

    constructor(x: number, y: number, z: number) {
        this.x = x
        this.y = y
        this.z = z
    }

    clone(): Vector3 {
        return new Vector3(this.x, this.y, this.z);
    }

    toString(): string {
        return `x:${this.x}, y:${this.y}, z:${this.z}`;
    }
}


export class Vector2 {
    x: number = 0
    y: number = 0

    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    toString(): string {
        return `x:${this.x}, y:${this.y}`;
    }
}


export class Color4 {
    r: number = 0
    g: number = 0
    b: number = 0
    a: number = 0

    constructor(r: number, g: number, b: number, a: number) {
        this.r = r
        this.g = g
        this.b = b
        this.a = a
    }

    clone(): Color4 {
        return new Color4(this.r, this.g, this.b, this.a);
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
    private frame_data: number[][] = []

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
