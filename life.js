import { wasmName } from './wasmname.js';
const perfZero = performance.now();

window.onload = function () {
    WebAssembly.instantiateStreaming(fetch(wasmName), functionImports)
        .then(main)
        .catch(failure);
};

let bufcache;
let f32cache;
let decoder;

function makeString(ptr, len) {
    if (bufcache === undefined) {
        bufcache = new Uint8Array(rustwasm.memory.buffer);
    }
    if (decoder === undefined) {
        decoder = new TextDecoder;
    }
    let out = (decoder).decode(bufcache.subarray(ptr, ptr + len));
    rustwasm.deallocUint8Array(ptr);
    return out;
}

window.makef32arr = (ptr, len) => {
    if (f32cache === undefined) {
        f32cache = new Float32Array(rustwasm.memory.buffer);
    }
    let out = f32cache.subarray((ptr / 4), ptr / 4 + len);
    // rustwasm.deallocFloat32Array(ptr);
    return out;
};

const functionImports = {
    math: Math,
    window: window,
    console: console,
    shim: {
        info_str: (ptr, len) => {
            console.info(makeString(ptr, len));
        },
    },
};

function main(result) {
    console.log(`WASM loaded! ${performance.now() - perfZero}ms`);
    window.rustwasm = result.instance.exports;
    const uni = rustwasm.allocateUniverse();
    const length = rustwasm.arrayLength();
    window.universe = uni;
    window.tick = () => { rustwasm.tickUniverse(uni); };
    window.view = () => {
        return new Uint8Array(rustwasm.memory.buffer, uni).subarray(0, length);
    };
    window.tcell = (x, y) => { rustwasm.toggleCell(uni, x, y); };

    // making a glider
    // rustwasm.toggleCell(uni, 1, 0);
    // rustwasm.toggleCell(uni, 2, 1);
    // rustwasm.toggleCell(uni, 0, 2);
    // rustwasm.toggleCell(uni, 1, 2);
    // rustwasm.toggleCell(uni, 2, 2);

    // fill universe with white noise
    rustwasm.addNoiseToUniverse(uni, 0.7);

    function lifecheck(str) {
        const a = view();
        let count = 0;
        for (const i in a) { if ((a[i] & 1) == 1) { count++; } }
        console.log(`${str} - population count: ${count} (${Math.round((1000 * count) / length) / 10}%)`);
    }
    lifecheck('Initial');

    const perfLoopZero = performance.now();

    const cycles = 10000;
    for (let i = 0; i < cycles; i++) {
        rustwasm.tickUniverse(uni);
    }

    console.log(`Simulated ${cycles} generations in ${performance.now() - perfLoopZero}ms`);

    lifecheck('JS/WASM');

    const perfCrunchZero = performance.now();

    rustwasm.timeCrunch(uni, cycles);

    console.log(`Crunched ${cycles} generations in ${performance.now() - perfCrunchZero}ms`);
    lifecheck('WASM');
}

function failure(error) { console.error(error); }