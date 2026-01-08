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

// 230×142 universe
const WIDTH: usize = 230;
const HEIGHT: usize = 142;
const LENGTH: usize = WIDTH * HEIGHT;

// 512 characters
const TEXTLEN: usize = 1 << 9;

// secure wrapper struct
struct DataBuf {
    // no need to worry about use of mut statics,
    // provided that there aren't multiple threads
    cells: [u8; LENGTH],

    text: [u8; TEXTLEN],

    // longest string received yet, to see how
    // long the string buffer might need to be
    str_max: usize,
}

// universe static mut
static mut UNIVERSE: DataBuf = DataBuf {
    cells: [0; LENGTH],
    text: [0; TEXTLEN],
    str_max: 0,
};

#[allow(static_mut_refs)]
// ~one single instance of "unsafe", instead of many
fn with_universe<F, R>(func: F) -> R
where
    F: FnOnce(&mut DataBuf) -> R,
{
    unsafe { func(&mut UNIVERSE) }
}

// for use with the shim::error/info/log functions
fn print<T>(msg: T, func: unsafe extern "C" fn(usize))
where
    T: AsRef<[u8]>,
{
    let arr = msg.as_ref();
    let len = arr.len().min(TEXTLEN);

    with_universe(|uni| {
        uni.str_max = uni.str_max.max(len);
        for (uni_byte, msg_byte) in &mut uni.text.iter_mut().zip(arr.iter()) {
            *uni_byte = *msg_byte;
        }
    });

    unsafe {
        func(len);
    }
}

#[export_name = "getInfo"]
pub extern "C" fn get_info(index: i32) -> i32 {
    match index {
        1 => with_universe(|uni| uni.cells.as_ptr()) as i32,
        10 => LENGTH as i32,
        11 => WIDTH as i32,
        12 => HEIGHT as i32,

        2 => with_universe(|uni| uni.text.as_ptr()) as i32,
        20 => TEXTLEN as i32,
        21 => with_universe(|uni| uni.str_max) as i32,

        _ => -999,
    }
}

#[export_name = "addNoiseToUniverse"]
pub extern "C" fn add_noise_to_universe(density: f32) {
    print("*pssshhhh*", shim::info);
    let mut rng = oorandom::Rand32::new(unsafe { math::random() }.to_bits() as u64);

    with_universe(|uni| {
        for i in uni.cells.iter_mut() {
            *i ^= u8::from(rng.rand_float() < density);
        }
    });
}

#[export_name = "clearUniverse"]
pub extern "C" fn clear_universe() {
    print("clearbing!!", shim::info);
    with_universe(|uni| {
        uni.cells.copy_from_slice(&[0; LENGTH]);
    });
}

#[export_name = "tickUniverse"]
pub extern "C" fn tick_universe() {
    // encoding: last bits of u8
    //         ... 0  0  0  0  0
    //     bit ... 4  3  2  1  0
    // bit 4: status in generation before tick
    // bit 0: status in generation after tick
    // this is chosen because every cell has 8 neighbors,
    // so we can sum cell values together, and then mask out
    // the bottom bits.

    const fn up(ci: usize) -> usize {
        ci + (LENGTH - WIDTH)
    }
    const fn down(ci: usize) -> usize {
        ci + WIDTH
    }
    const fn left(ci: usize) -> usize {
        if ci.is_multiple_of(WIDTH) {
            // left side; wrap to right side - klein bottle
            (LENGTH - 1) - ci
        } else {
            ci - 1
        }
    }
    const fn right(ci: usize) -> usize {
        if (ci + 1).is_multiple_of(WIDTH) {
            // right side; wrap to left side - klein bottle
            (LENGTH - 1) - ci
        } else {
            ci + 1
        }
    }

    with_universe(|uni| {
        // set array
        for cell in uni.cells.iter_mut() {
            *cell = if (*cell & 1) == 1 {
                // mark "alive in next generation" cells as "alive in current generation"
                1 << 4
            } else {
                0
            };
        }

        for index in 0..LENGTH {
            // sum of previous-generation neighbors
            let sum = (uni.cells[up(index) % LENGTH]
                + uni.cells[down(index) % LENGTH]
                + uni.cells[left(index) % LENGTH]
                + uni.cells[right(index) % LENGTH]
                + uni.cells[up(left(index)) % LENGTH]
                + uni.cells[down(left(index)) % LENGTH]
                + uni.cells[up(right(index)) % LENGTH]
                + uni.cells[down(right(index)) % LENGTH])
                >> 4;

            if let 2 | 3 = sum {
                if uni.cells[index] == 1 << 4 {
                    // cell was alive when tick began
                    // set lowest bit ("alive in next gen")
                    uni.cells[index] ^= 1
                } else if sum == 3 {
                    // cell was empty when tick began
                    // 3 neighbors: cell is born
                    uni.cells[index] ^= 1
                }
                // otherwise nothing happens, lowest bit left blank
            }
        }
    });
}

#[export_name = "timeCrunch"]
pub extern "C" fn time_crunch(gens: i32) {
    for _i in 0..gens {
        tick_universe();
    }
}

#[export_name = "toggleCell"]
pub extern "C" fn toggle_cell(x: i32, y: i32) {
    let index = (x as usize % WIDTH) + (y as usize % HEIGHT) * WIDTH;
    with_universe(|uni| {
        uni.cells[index] ^= 1;
    });
}
