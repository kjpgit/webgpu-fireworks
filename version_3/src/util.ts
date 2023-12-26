


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

