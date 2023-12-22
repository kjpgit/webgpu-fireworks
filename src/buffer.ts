// Safe wrapper for an array of floats.
// Ensures we don't add more data than is allocated

export class BufferWrapper {
    private buffer: Float32Array
    private max_elements: number
    private nr_elements: number

    constructor(buffer: Float32Array) {
      this.buffer = buffer
      this.max_elements = buffer.length
      this.nr_elements = 0
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

    // If capacity is full, do nothing

    /*
    append_array(v: Float32Array) {
        this.buffer.set(v, this.nr_elements)
        this.nr_elements += v.length
    }
   */

  /*
    appendVector3(v: Vector3) {
        if (this.has_available(3)) {
            this.append_raw(v.x)
            this.append_raw(v.y)
            this.append_raw(v.z)
        }
    }
   */

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

    /*
    length(): number {
        return Math.sqrt((this.x * this.x) + (this.y * this.y) + (this.z * this.z))
    }
   */
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

