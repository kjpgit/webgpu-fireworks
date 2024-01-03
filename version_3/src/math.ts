// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

import { Vector2, Vector3  } from "./util.js";

const PI = 3.1415926535

const MYRANDOM_VALS = [
    0.0, 0.25, 0.50, 0.75, 0.99999999,
    0.1, 0.35, 0.45, 0.85,
    0.2, 0.45, 0.55, 0.95,
    0.3, 0.6, 0.9,
    0.16, 0.33, 0.66, 0.83,
]

var g_rand_idx = 0;


// Return number in range [0, 1)
function my_random(): number
{
    //g_rand_idx += 1;
    //let ret = MYRANDOM_VALS[g_rand_idx % MYRANDOM_VALS.length];
    let ret = Math.random();
    //console.log("my_random: " + ret);
    return ret;
}

// Return number in range [lower, upper)
export function random_range(arr: number[]): number {
    const lower = arr[0]
    const upper = arr[1]
    if (lower > upper) {
        throw new Error("invalid range");
    }
    let delta = upper - lower
    let ret = (my_random() * delta) + lower

    if (arr.length > 2) {
        const round_to = arr[2];
        ret = Math.round(ret / round_to) * round_to;
    }
    return ret
}

export function clamp(f: number): number {
    return Math.max(0, Math.min(1.0, f))
}

export function float_to_u8(f: number): number {
    return Math.floor(0.5 + 255 * clamp(f))
}



// If @value <= @min, return 0
// If @value >= @max, return 1
// If @value is between @min and @max, return a smooth interpolation between 0 and 1.
export function smoothstep(min:number, max:number, value:number) {
    var x = Math.max(0, Math.min(1, (value-min)/(max-min)));
    return x * x * (3 - 2*x);
}


export function RandomUniformUnitVector3D(): Vector3 {
    // Rotation around equator
    let phi = random_range([0.0, 2.0 * PI])

    // The z-value of a point on the unit sphere is
    // uniformly distributed between −1 and 1
    let height = random_range([-1,1])

    let theta = Math.acos(height)
    let x = Math.sin(theta) * Math.cos(phi)
    let y = Math.sin(theta) * Math.sin(phi)
    let z = Math.cos(theta)
    return new Vector3(x,y,z)

}


