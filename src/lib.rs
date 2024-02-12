pub mod import {
    // #[link(wasm_import_module(functions))]
    // #[link_name = "something"]
}

const WIDTH: usize = 32;
const HEIGHT: usize = 32;
const LENGTH: usize = WIDTH * HEIGHT;
type Universe = [u8; LENGTH];

#[export_name = "allocateUniverse"]
pub extern "C" fn allocate_universe() -> *mut Universe {
    let universe = [0; LENGTH];
    Box::into_raw(Box::new(universe))
}

#[export_name = "tickUniverse"]
pub unsafe extern "C" fn tick_universe(uni: *mut Universe) {
    // this other variant compiles to identical code:
    //    if !uni.is_null() {
    //        (&mut *uni)[9] = 2;
    //    }
    if let Some(uni) = uni.as_mut() {
        uni[9] = 2;
    }
}

#[export_name = "removeUniverse"]
pub unsafe extern "C" fn remove_universe(uni: *mut Universe) {
    drop(Box::from_raw(uni));
}
