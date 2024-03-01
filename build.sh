# Build, optimize WASM file for speed
# Requires binaryen
cargo build -r
# Optimize in place; dev branch testing setup doesn't match demo branch
wasm-opt -O3 -o target/wasm32-unknown-unknown/release/life.wasm target/wasm32-unknown-unknown/release/life.wasm