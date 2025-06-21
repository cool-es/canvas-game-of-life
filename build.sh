# Build, optimize WASM file for speed, move it to this directory
# Requires binaryen
cargo build -r
wasm-opt -O3 -o demo.wasm target/wasm32-unknown-unknown/release/life.wasm
