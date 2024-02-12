import { wasmName } from './wasmname.js';
const perfZero = performance.now();

window.onload = function () {
    WebAssembly.instantiateStreaming(fetch(wasmName), functionImports)
        .then(main)
        .catch(failure);
};

const functionImports = { env: {} };

function main(result) {
    console.log(`WASM loaded! ${performance.now() - perfZero}ms`);
    window.rustwasm = result.instance.exports;
    const uni = rustwasm.allocateUniverse();
    const length = 8 ** 2;

    window.universe = uni;
    window.tick = () => { rustwasm.tickUniverse(uni); };
    window.view = () => {
        return new Uint8Array(rustwasm.memory.buffer, uni).subarray(0, length);
    };
    window.tcell = (x, y) => { rustwasm.toggleCell(uni, x, y); };

    // making a glider
    rustwasm.toggleCell(uni, 1, 0);
    rustwasm.toggleCell(uni, 2, 1);
    rustwasm.toggleCell(uni, 0, 2);
    rustwasm.toggleCell(uni, 1, 2);
    rustwasm.toggleCell(uni, 2, 2);

    const perfLoopZero = performance.now();

    const cycles = 10000;
    for (let i = 0; i < cycles; i++) {
        rustwasm.tickUniverse(uni);
    }

    console.log(`Simulated ${cycles} generations in ${performance.now() - perfLoopZero}ms`);

    function lifecheck() {
        const a = view();
        let count = 0;
        for (const i in a) { if ((a[i] & 1) == 1) { count++; } }
        console.log(`Population count: ${count}`);
    }
    lifecheck();

    const perfCrunchZero = performance.now();

    rustwasm.timeCrunch(uni, cycles);

    console.log(`Crunched ${cycles} generations in ${performance.now() - perfCrunchZero}ms`);
    lifecheck();
}

function failure(error) { console.error(error); }