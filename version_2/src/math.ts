import { Vector3  } from "./buffer.js";

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
export function my_random(): number
{
    g_rand_idx += 1;
    let ret = MYRANDOM_VALS[g_rand_idx % MYRANDOM_VALS.length];
    //console.log("my_random: " + ret);
    return ret;
}

// Return number in range [lower, upper)
export function random_range(lower: number, upper: number): number {
    if (lower > upper) {
        throw new Error("invalid range");
    }
    let delta = upper - lower
    let ret = (my_random() * delta) + lower
    return ret
}

/*
Return random 3D vector.  Length will be == 1.
Source: gamedev.net
This finds a random point on a solid circle (disc), than finds the height of
the sphere at that point.  It can use the top or bottom hemisphere for z.  This
gives better distribution than two random angles (which will produce more
points clustered at the poles)
*/
export function RandomUniformUnitVector(): Vector3 {
    const angle = random_range(0.0, 2.0 * PI)
    const r = Math.sqrt(random_range(0.0, 1.0))
    const hemisphere = 1.0 // random_choose(-1.0, 1.0)
    const z = Math.sqrt(1.0 - r*r) * hemisphere
    return new Vector3(r * Math.cos(angle), r * Math.sin(angle), z)
}

export function smoothstep (min:number, max:number, value:number) {
  var x = Math.max(0, Math.min(1, (value-min)/(max-min)));
  return x*x*(3 - 2*x);
}
