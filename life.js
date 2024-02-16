import { wasmName } from './wasmname.js';
let perfZero = performance.now();

window.onload = function () {
    WebAssembly.instantiateStreaming(fetch(wasmName), functionImports)
        .then(main)
        .catch(failure);
};

let bufferCache;
let decoderCache;
let stringPtr;
let f32Ptr;
let f32Len;

function makeString(len) {
    if (bufferCache === undefined) {
        bufferCache = new Uint8Array(rustwasm.memory.buffer);
    }
    if (decoderCache === undefined) {
        decoderCache = new TextDecoder;
    }
    return decoderCache.decode(bufferCache.subarray(stringPtr, stringPtr + len));
}

function makeFloatArray() {
    return Array.from(
        new Float32Array(rustwasm.memory.buffer).subarray((f32Ptr / 4), f32Ptr / 4 + f32Len)
    );
}

window.noiseFloats = () => {
    rustwasm.rewriteFloat32Array(f32Ptr);
    return makeFloatArray();
}

window.fillFloats = () => {
    rustwasm.fillFloat32Array(f32Ptr);
    return makeFloatArray();
}

const functionImports = {
    math: Math,
    window: window,
    console: console,
    shim: {
        error: len => {
            console.error(makeString(len));
        },
        info: len => {
            console.info(makeString(len));
        },
        log: len => {
            console.log(makeString(len));
        },

        now: () => {
            return performance.now();
        }
    },
};

function main(result) {
    console.log(`WASM loaded! ${performance.now() - perfZero}ms`);
    window.rustwasm = result.instance.exports;

    const uniPtr = rustwasm.getInfo(1);
    const uniLen = rustwasm.getInfo(10);
    stringPtr = rustwasm.getInfo(2);
    f32Ptr = rustwasm.getInfo(3);
    f32Len = rustwasm.getInfo(30);

    window.maxStr = () => { return rustwasm.getInfo(21); }

    window.viewUni = () => {
        if (bufferCache === undefined) {
            bufferCache = new Uint8Array(rustwasm.memory.buffer);
        }
        return bufferCache.subarray(uniPtr, uniPtr + uniLen);
    }

    // window.tcell = (x, y) => { rustwasm.toggleCell(x, y); };

    window.runLife = () => {
        function lifecheck(str) {
            const a = viewUni();
            let count = 0;
            for (const i in a) { if ((a[i] & 1) == 1) { count++; } }
            console.log(`${str} - population count: ${count} (${Math.round((1000 * count) / uniLen) / 10}%)`);
        }

        // making a glider
        // rustwasm.toggleCell(uni, 1, 0);
        // rustwasm.toggleCell(uni, 2, 1);
        // rustwasm.toggleCell(uni, 0, 2);
        // rustwasm.toggleCell(uni, 1, 2);
        // rustwasm.toggleCell(uni, 2, 2);

        // fill universe with white noise

        rustwasm.addNoiseToUniverse(0.7);
        lifecheck('Initial');
        perfZero = performance.now();
        const cycles = 10000;
        for (let i = 0; i < cycles; i++) {
            rustwasm.tickUniverse();
        }

        console.log(`Simulated ${cycles} generations in ${performance.now() - perfZero}ms`);
        lifecheck('JS/WASM');

        rustwasm.addNoiseToUniverse(0.7);
        lifecheck('Initial');
        perfZero = performance.now();
        rustwasm.timeCrunch(cycles);

        console.log(`Crunched ${cycles} generations in ${performance.now() - perfZero}ms`);
        lifecheck('WASM');
    };
}

function failure(error) { console.error(error); }