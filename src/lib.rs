pub mod import {
    // #[link(wasm_import_module(functions))]
    // #[link_name = "something"]
}

const WIDTH: usize = 8;
const HEIGHT: usize = WIDTH;
const LENGTH: usize = WIDTH * HEIGHT;
type Universe = [u8; LENGTH];

#[export_name = "allocateUniverse"]
pub extern "C" fn allocate_universe() -> *mut Universe {
    let universe = [0; LENGTH];
    Box::into_raw(Box::new(universe))
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
        if ci % WIDTH == 1 {
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

    for index in 0..WIDTH {
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

        if uni[index] >> 4 == 1 {
            // cell was alive when tick began
            match sum {
                // 3 or 4 neighbors: cell lives
                // set lowest bit ("alive in next gen")
                3 | 4 => uni[index] ^= 1,

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

#[export_name = "removeUniverse"]
pub unsafe extern "C" fn remove_universe(uni: *mut Universe) {
    drop(Box::from_raw(uni));
}
