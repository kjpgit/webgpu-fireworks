// Galaxy Engine - Copyright (C) 2023 Karl Pickett - All Rights Reserved

import * as constants from "./constants.js"
import { type Scene, Engine } from "./engine.js";
import { Vector2, Vector3, Color4  } from "./util.js";

const PERFTEST_FRAME = 0
const PERFTEST_PAGE = 0


export class DebugScene1 implements Scene
{
    // 10,000 little dots, so pretty
    // Getting 30fps starting 10k branch
    draw(engine: Engine) {
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
                draw_test_dot(engine, new Vector2(wx, wy), 0.0025, color)
            }
        }
    }
}

export class DebugScene2 implements Scene
{
    // Shows our tile grid
    draw(engine: Engine) {
        for (var x = 0; x < constants.NUM_TILES_X; x++) {
            for (var y = 0; y < constants.NUM_TILES_Y; y++) {
                // If only we could draw a line :)
                // Draw corners for now
                let wx = (x + 0.0) / constants.NUM_TILES_X
                let wy = (y + 0.0) / constants.NUM_TILES_Y
                let color = new Color4(0.0, 0.0, 0.0, 0.0);
                color.b = 1;
                draw_test_dot(engine, new Vector2(wx, wy), 0.0010, color)
            }
        }
    }
}

export class DebugScene3 implements Scene
{
    // Trying galaxy orbit...
    draw(engine: Engine) {
        //engine.current_time = 0

        // White - centers
        draw_test_dot(engine, new Vector2(0.5,0.6), 0.01, new Color4(1,1,1,0))
        draw_test_dot(engine, new Vector2(0.5,0.3), 0.01, new Color4(1,1,1,0))

        // Red - full x
        let flags = constants.SHAPE_FLAG_ROTATE;
        draw_test_dot(engine, new Vector2(0.5,0.3), 0.01, new Color4(1,0,0,0), flags,
                          new Vector3(1.0, 0.0, 0.0))

        // Blue - negative x
        draw_test_dot(engine, new Vector2(0.5,0.3), 0.01, new Color4(0,0,1,0), flags,
                          new Vector3(-1.0, 0.0, 0.0))

        // Others - Mixed -
        draw_test_dot(engine, new Vector2(0.5,0.3), 0.01, new Color4(1,1,0,0), flags,
                          new Vector3(0.707, 0.707, 0.0))
        draw_test_dot(engine, new Vector2(0.5,0.3), 0.01, new Color4(0,1,0.5,0), flags,
                          new Vector3(-0.707, 0.707, 0.0))
        draw_test_dot(engine, new Vector2(0.5,0.3), 0.01, new Color4(1,0,1.0,0), flags,
                          new Vector3(0.2, 1.0, 0.0))
    }
}

    /*
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
        }

       */



function draw_test_dot(engine: Engine, world_pos: Vector2, world_radius: number,
              color: Color4,
              flags?: number,
              velocity?: Vector3)
{
    engine.rough_wrapper.append_raw_f32(world_pos.x)
    engine.rough_wrapper.append_raw_f32(world_pos.y)
    engine.rough_wrapper.append_raw_f32(0.5)
    engine.rough_wrapper.append_raw_f32(999)  // padding

    if (velocity !== undefined) {
        engine.rough_wrapper.append_raw_f32(velocity.x)
        engine.rough_wrapper.append_raw_f32(velocity.y)
        engine.rough_wrapper.append_raw_f32(velocity.z)
    } else {
        engine.rough_wrapper.append_raw_f32(0)
        engine.rough_wrapper.append_raw_f32(0)
        engine.rough_wrapper.append_raw_f32(0)
    }
    engine.rough_wrapper.append_raw_f32(999)  // padding

    engine.rough_wrapper.append_raw_f32(world_radius)
    engine.rough_wrapper.append_raw_f32(0)    // start time
    engine.rough_wrapper.append_raw_f32(999999)    // duration
    if (typeof flags !== "undefined") {
        engine.rough_wrapper.append_raw_u32(flags)
    } else {
        engine.rough_wrapper.append_raw_u32(0)
    }

    engine.rough_wrapper.append_raw_color4(color)
}

