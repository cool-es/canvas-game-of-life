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

// 256×128 universe
const WIDTH: usize = 1 << 8;
const HEIGHT: usize = 1 << 7;
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

impl DataBuf {
    fn toggle_cell(&mut self, x: i32, y: i32) {
        let x = (x % WIDTH as i32) as usize;
        let y = (y % HEIGHT as i32) as usize;

        self.cells[x + y * WIDTH] ^= 1;
    }

    fn tick_universe(&mut self) {
        // encoding: last bits of u8
        //         ... 0  0  0  0  0
        //     bit ... 4  3  2  1  0
        // bit 4: status in generation before tick
        // bit 0: status in generation after tick
        // this is chosen because every cell has 8 neighbors,
        // so we can sum cell values together, and then mask out
        // the bottom bits.

        // set array
        for c in self.cells.iter_mut() {
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
            let sum = (self.cells[u(index) % LENGTH]
                + self.cells[d(index) % LENGTH]
                + self.cells[l(index) % LENGTH]
                + self.cells[r(index) % LENGTH]
                + self.cells[u(l(index)) % LENGTH]
                + self.cells[d(l(index)) % LENGTH]
                + self.cells[u(r(index)) % LENGTH]
                + self.cells[d(r(index)) % LENGTH])
                >> 4;

            // simple speed optimization
            if ![2, 3].contains(&sum) {
                continue;
            }

            if self.cells[index] == 1 << 4 {
                // cell was alive when tick began
                match sum {
                    // 2 or 3 neighbors: cell lives
                    // set lowest bit ("alive in next gen")
                    2 | 3 => self.cells[index] ^= 1,

                    // otherwise cell dies
                    // lowest bit left blank
                    _ => {}
                }
            } else {
                // cell was empty when tick began
                match sum {
                    // 3 neighbors: cell is born
                    // set lowest bit ("alive in next gen")
                    3 => self.cells[index] ^= 1,

                    // otherwise nothing happens
                    // lowest bit left blank
                    _ => {}
                }
            }
        }
    }

    fn clear_universe(&mut self) {
        print("clearbing!!", shim::info);
        for i in self.cells.iter_mut() {
            *i = 0;
        }
    }

    fn add_noise_to_universe(&mut self, density: f32) {
        print("*pssshhhh*", shim::info);

        let mut rng = unsafe { oorandom::Rand32::new(math::random().to_bits() as u64) };
        for i in self.cells.iter_mut() {
            *i ^= u8::from(rng.rand_float() < density);
        }
    }

    fn print<T>(&mut self, msg: T, func: unsafe extern "C" fn(usize))
    where
        T: AsRef<[u8]>,
    {
        let arr = msg.as_ref();
        let len = arr.len().min(TEXTLEN);
        let str_max = &mut self.str_max;
        if len > *str_max {
            *str_max = len;
        }

        for (a, b) in &mut self.text.iter_mut().zip(arr.iter()) {
            *a = *b;
        }

        unsafe {
            func(len);
        }
    }
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
    with_universe(|u| u.print(msg, func))
}

#[export_name = "getInfo"]
pub extern "C" fn get_info(index: i32) -> i32 {
    match index {
        1 => with_universe(|u| u.cells.as_ptr() as i32),
        10 => LENGTH as i32,
        11 => WIDTH as i32,
        12 => HEIGHT as i32,

        2 => with_universe(|u| u.text.as_ptr() as i32),
        20 => TEXTLEN as i32,
        21 => with_universe(|u| u.str_max as i32),

        _ => -999,
    }
}

#[export_name = "addNoiseToUniverse"]
pub extern "C" fn add_noise_to_universe(density: f32) {
    with_universe(|u| u.add_noise_to_universe(density))
}

#[export_name = "clearUniverse"]
pub extern "C" fn clear_universe() {
    with_universe(|u| u.clear_universe())
}

#[export_name = "tickUniverse"]
pub extern "C" fn tick_universe() {
    with_universe(|u| u.tick_universe())
}

#[export_name = "timeCrunch"]
pub extern "C" fn time_crunch(gens: i32) {
    for _i in 0..gens {
        tick_universe();
    }
}

#[export_name = "toggleCell"]
pub extern "C" fn toggle_cell(x: i32, y: i32) {
    with_universe(|u| u.toggle_cell(x, y));
}
