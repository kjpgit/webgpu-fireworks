import { Vector3  } from "./buffer.js";

const PI = 3.1415926535
const RANDOM_RANGE_DEBUG = false

// Return Int in range [lower, upper)
export function random_range(lower: number, upper: number): number {
    //precondition(lower <= upper)
    //if RANDOM_RANGE_DEBUG { return random_choose(lower, upper); }
    let delta = upper - lower
    let ret = (Math.random() * delta) + lower
    //console.log(`random ${lower} ${upper} = ${ret}`)
    //precondition(ret >= lower)
    //precondition(ret <= upper)
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
