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
}

function failure(error) { console.error(error); }