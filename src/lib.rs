use import::*;

pub mod import {
    pub mod console {
        #[link(wasm_import_module = "console")]
        extern "C" {
            pub fn log(num: i32);
        }
    }
    pub mod math {
        #[link(wasm_import_module = "math")]
        extern "C" {
            pub fn random() -> f32;
        }
    }
    pub mod window {
        #[link(wasm_import_module = "window")]
        extern "C" {
            pub fn alert(message: i32);
        }
    }
    pub mod shim {
        #[link(wasm_import_module = "shim")]
        extern "C" {
            // receive string pointer and print to console
            pub fn error(len: usize);
            pub fn info(len: usize);
            pub fn log(len: usize);
            pub fn warn(len: usize);

            // timer, seemingly inaccessible
            // from wasm normally
            pub fn now() -> i32;
        }
    }
}

// 128×128 universe
const WIDTH: usize = 1 << 7;
const HEIGHT: usize = WIDTH;
const LENGTH: usize = WIDTH * HEIGHT;

// no need to worry about use of mut statics,
// provided that there aren't multiple threads
static mut UNI: [u8; LENGTH] = [0; LENGTH];

// 512 characters
const TEXTLEN: usize = 1 << 9;
static mut TEXT: [u8; TEXTLEN] = [0; TEXTLEN];

// longest string received yet, to see how
// long the string buffer might need to be
static mut STR_MAX: usize = 0;

// 16m samples (64 MB)
const FLOATLEN: usize = 1 << 24;
static mut FLOATS: [f32; FLOATLEN] = [0.0; FLOATLEN];

// for use with the shim::error/info/log functions
fn print<T>(msg: T, func: unsafe extern "C" fn(usize))
where
    T: AsRef<[u8]>,
{
    unsafe {
        let arr = msg.as_ref();
        if arr.len() > STR_MAX {
            STR_MAX = arr.len();
        }
        for (a, b) in TEXT.iter_mut().zip(arr.iter()) {
            *a = *b;
        }
        func(arr.len().min(TEXTLEN));
    }
}

#[export_name = "f32Sine"]
pub unsafe extern "C" fn f32_sine() {
    let perf_zero = shim::now();
    for (i, elem) in FLOATS.iter_mut().enumerate() {
        *elem = ((2.0 * std::f32::consts::PI * i as f32) / FLOATLEN as f32).sin();
    }
    let time = shim::now() - perf_zero;
    f32_info(time, "sine wave");
}

#[export_name = "f32Noise"]
pub unsafe extern "C" fn f32_noise() {
    let perf_zero = shim::now();
    for elem in FLOATS.iter_mut() {
        *elem = math::random();
    }
    let time = shim::now() - perf_zero;
    f32_info(time, "JS noise");
}

fn f32_info(time: i32, sting: &str) {
    print(
        format!(
            "Filled {FLOATLEN} element ({} s @ 44.1 kHz) f32 array with {sting} in {time} ms (generation rate {} MHz, {} s/s)",
            FLOATLEN as f32 / 44100.0,
            FLOATLEN as f32 / (1000.0 * time as f32),
            FLOATLEN as f32 / (44.1 * time as f32),
        ),
        shim::info,
    );
}

#[export_name = "getInfo"]
pub unsafe extern "C" fn get_info(index: i32) -> i32 {
    match index {
        1 => &UNI as *const u8 as i32,
        10 => LENGTH as i32,
        11 => WIDTH as i32,
        12 => HEIGHT as i32,

        2 => &TEXT as *const u8 as i32,
        20 => TEXTLEN as i32,
        21 => STR_MAX as i32,

        3 => &FLOATS as *const f32 as i32,
        30 => FLOATLEN as i32,

        _ => -999,
    }
}

#[export_name = "addNoiseToUniverse"]
pub unsafe extern "C" fn add_noise_to_universe(density: f32) {
    print("*pssshhhh*", shim::info);
    for i in UNI.iter_mut() {
        if math::random() < density {
            *i ^= 1;
        }
    }
}

#[export_name = "clearUniverse"]
pub unsafe extern "C" fn clear_universe() {
    for i in UNI.iter_mut() {
        *i = 0;
    }
}

#[export_name = "tickUniverse"]
pub unsafe extern "C" fn tick_universe() {
    // encoding: last bits of u8
    //         ... 0  0  0  0  0
    //     bit ... 4  3  2  1  0
    // bit 4: status in generation before tick
    // bit 0: status in generation after tick
    // this is chosen because every cell has 8 neighbors,
    // so we can sum cell values together, and then mask out
    // the bottom bits.

    // set array
    for c in UNI.iter_mut() {
        *c = if (*c & 1) == 1 { 1 << 4 } else { 0 };
    }

    let u = |ci: usize| ci + (LENGTH - WIDTH);
    let d = |ci: usize| ci + WIDTH;
    let l = |ci: usize| {
        if ci % WIDTH == 0 {
            // left side; wrap to right side - klein bottle
            (LENGTH - 1) - ci
        } else {
            ci - 1
        }
    };
    let r = |ci: usize| {
        if (ci + 1) % WIDTH == 0 {
            // right side; wrap to left side - klein bottle
            (LENGTH - 1) - ci
        } else {
            ci + 1
        }
    };

    for index in 0..LENGTH {
        // sum of previous-generation neighbors
        let sum = [
            UNI[u(index) % LENGTH],
            UNI[d(index) % LENGTH],
            UNI[l(index) % LENGTH],
            UNI[r(index) % LENGTH],
            UNI[u(l(index)) % LENGTH],
            UNI[d(l(index)) % LENGTH],
            UNI[u(r(index)) % LENGTH],
            UNI[d(r(index)) % LENGTH],
        ]
        .into_iter()
        .sum::<u8>()
            >> 4;

        if UNI[index] == 1 << 4 {
            // cell was alive when tick began
            match sum {
                // 2 or 3 neighbors: cell lives
                // set lowest bit ("alive in next gen")
                2 | 3 => UNI[index] ^= 1,

                // otherwise cell dies
                // lowest bit left blank
                _ => {}
            }
        } else {
            // cell was empty when tick began
            match sum {
                // 3 neighbors: cell is born
                // set lowest bit ("alive in next gen")
                3 => UNI[index] ^= 1,

                // otherwise nothing happens
                // lowest bit left blank
                _ => {}
            }
        }
    }
}

#[export_name = "timeCrunch"]
pub unsafe extern "C" fn time_crunch(gens: i32) {
    for _i in 0..gens {
        tick_universe();
    }
}

#[export_name = "toggleCell"]
pub unsafe extern "C" fn toggle_cell(x: i32, y: i32) {
    let x = (x % WIDTH as i32) as usize;
    let y = (y % HEIGHT as i32) as usize;

    UNI[x + y * WIDTH] ^= 1;
}
