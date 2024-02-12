import { wasmName } from './wasmname.js';

window.onload = function () {
    WebAssembly.instantiateStreaming(fetch(wasmName), functionImports)
        .then(main)
        .catch(failure);
};

const functionImports = { env: {} };

function main(result) {
    console.log('WASM loaded!')
    window.rustwasm = result.instance.exports;
    const uni = rustwasm.allocateUniverse();
    const length = 8**2;

    window.universe = uni;
    window.tick = () => { rustwasm.tickUniverse(uni); }
    window.view = () => {
        return new Uint8Array(rustwasm.memory.buffer, uni).subarray(0, length);
    }
}

function failure(error) { console.error(error); }