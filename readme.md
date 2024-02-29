# Conway's Game of Life in JS + Rust/WASM <br><a href="https://cool-es.github.io/canvas-game-of-life/" style="font-weight:bold; ">😮 <i>See it live here!</i></a>

No binding generators are used; all code is hand-written.

The "playing field" is flipped top-to-bottom at the edges (meaning it's topologically a [Klein bottle](https://en.wikipedia.org/wiki/Klein_bottle)); this is an intentional choice to make glider paths more interesting.

The "playing field" is stored in a `static mut [u8; 16384]` in the Rust WASM code, and a pointer to its memory location is passed to the JS side, which reads it from the WASM memory buffer as a `Uint8Array`.

There is some fairly deep integration between the WASM and JS code; the JS code is given direct access to Rust/WASM functions and vice versa. One example of this is that the "add noise" button prints an info message to the JS console, by this series of events:
* The button triggers the JS function `addNoise()`,
* which is a wrapper for the imported Rust function `add_noise_to_universe()`,
* which writes a string to the Rust text buffer `TEXT`, and passes its length to the imported JS function `shim.info()`,
* which calls `makeString()`, which reads the text out of the WASM memory buffer directly and converts it to a string,
* and passes the resulting string to `console.info()`.