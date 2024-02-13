pub mod import {
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
    pub mod console {
        #[link(wasm_import_module = "console")]
        extern "C" {
            pub fn log(num: i32);
        }
    }
    pub mod shim {
        use std::ffi::c_char;
        #[link(wasm_import_module = "shim")]
        extern "C" {
            pub fn info_str(ptr: *mut c_char, len: usize);
        }
    }
}

mod shim {
    use crate::import::shim;
    use std::ffi::CString;

    pub unsafe fn info<T>(msg: T)
    where
        T: Into<Vec<u8>>,
    {
        let string = CString::new(msg).unwrap_or_default();
        let len = string.as_bytes().len();
        let ptr = string.into_raw();
        shim::info_str(ptr, len);
    }
}

const WIDTH: usize = 128;
const HEIGHT: usize = WIDTH;
const LENGTH: usize = WIDTH * HEIGHT;
type Universe = [u8; LENGTH];

#[export_name = "allocFloat32Array"]
pub extern "C" fn alloc_float32_array() -> *mut [f32; 20] {
    let mut arr = [0.0; 20];
    for (i, elem) in arr.iter_mut().enumerate() {
        *elem = ((std::f32::consts::PI * i as f32) / 10.0).sin();
    }
    Box::into_raw(Box::new(arr))
}

// this command doesn't seem to actually do anything -
// it seems like it can't change the buffer at all?
#[export_name = "deallocUint8Array"]
pub unsafe extern "C" fn dealloc_uint8_array(ptr: *mut std::ffi::c_char) {
    // let pp = &mut *(ptr as *mut [u8; 4]);
    // *pp = [48, 49, 50, 51];
    dealloc(ptr);
}

unsafe fn dealloc<T>(ptr: *mut T) {
    drop(Box::from_raw(ptr));
}

#[export_name = "arrayLength"]
pub extern "C" fn array_length() -> i32 {
    LENGTH as i32
}

#[export_name = "allocateUniverse"]
pub extern "C" fn allocate_universe() -> *mut Universe {
    let universe = [0; LENGTH];
    Box::into_raw(Box::new(universe))
}

#[export_name = "addNoiseToUniverse"]
pub unsafe extern "C" fn add_noise_to_universe(uni: *mut Universe, density: f32) {
    shim::info("*pssshhhh*");
    assert!(!uni.is_null());
    let uni = &mut *uni;

    for i in uni.iter_mut() {
        if import::math::random() < density {
            *i ^= 1;
        }
    }
}

#[export_name = "tickUniverse"]
pub unsafe extern "C" fn tick_universe(uni: *mut Universe) {
    assert!(!uni.is_null());
    let uni = &mut *uni;

    // encoding: last bits of u8
    //         ... 0  0  0  0  0
    //     bit ... 4  3  2  1  0
    // bit 4: status in generation before tick
    // bit 0: status in generation after tick
    // this is chosen because every cell has 8 neighbors,
    // so we can sum cell values together, and then mask out
    // the bottom bits.

    // set array
    for c in uni.iter_mut() {
        *c = if (*c & 1) == 1 { 1 << 4 } else { 0 };
    }

    let u = |ci: usize| ci + (LENGTH - WIDTH);
    let d = |ci: usize| ci + WIDTH;
    let l = |ci: usize| {
        if ci % WIDTH == 0 {
            // left side; wrap to right side
            ci + (WIDTH - 1)
        } else {
            ci - 1
        }
    };
    let r = |ci: usize| {
        if (ci + 1) % WIDTH == 0 {
            // right side; wrap to left side
            ci + (LENGTH - WIDTH + 1)
        } else {
            ci + 1
        }
    };

    for index in 0..LENGTH {
        // sum of previous-generation neighbors
        let sum = [
            uni[u(index) % LENGTH],
            uni[d(index) % LENGTH],
            uni[l(index) % LENGTH],
            uni[r(index) % LENGTH],
            uni[u(l(index)) % LENGTH],
            uni[d(l(index)) % LENGTH],
            uni[u(r(index)) % LENGTH],
            uni[d(r(index)) % LENGTH],
        ]
        .into_iter()
        .sum::<u8>()
            >> 4;

        if uni[index] == 1 << 4 {
            // cell was alive when tick began
            match sum {
                // 2 or 3 neighbors: cell lives
                // set lowest bit ("alive in next gen")
                2 | 3 => uni[index] ^= 1,

                // otherwise cell dies
                // lowest bit left blank
                _ => {}
            }
        } else {
            // cell was empty when tick began
            match sum {
                // 3 neighbors: cell is born
                // set lowest bit ("alive in next gen")
                3 => uni[index] ^= 1,

                // otherwise nothing happens
                // lowest bit left blank
                _ => {}
            }
        }
    }
}

#[export_name = "timeCrunch"]
pub unsafe extern "C" fn time_crunch(uni: *mut Universe, gens: i32) {
    for _i in 0..gens {
        tick_universe(uni);
    }
}

#[export_name = "toggleCell"]
pub unsafe extern "C" fn toggle_cell(uni: *mut Universe, x: i32, y: i32) {
    assert!(!uni.is_null());
    let uni = &mut *uni;
    let x = (x % WIDTH as i32) as usize;
    let y = (y % HEIGHT as i32) as usize;

    uni[x + y * WIDTH] ^= 1;
}

#[export_name = "removeUniverse"]
pub unsafe extern "C" fn remove_universe(uni: *mut Universe) {
    dealloc(uni);
}
