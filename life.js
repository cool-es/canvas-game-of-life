import { wasmName } from './wasmname.js';
let perfZero = performance.now();

window.onload = function () {
    WebAssembly.instantiateStreaming(fetch(wasmName), functionImports)
        .then(main)
        .catch(failure);
};

const niceDecoder = new TextDecoder;
let bufferCache;
let stringPtr;
let f32Ptr;
let f32Len;

function makeString(len) {
    return niceDecoder.decode(bufferCache.subarray(stringPtr, stringPtr + len));
}

window.makeFloatArray = () => {
    return Array.from(
        new Float32Array(rustwasm.memory.buffer).subarray((f32Ptr / 4), f32Ptr / 4 + f32Len)
    );
}

const functionImports = {
    console: console,
    math: Math,
    window: window,
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
    bufferCache = new Uint8Array(rustwasm.memory.buffer);

    const uniPtr = rustwasm.getInfo(1);
    const uniLen = rustwasm.getInfo(10);
    const uniX = rustwasm.getInfo(11);
    const uniY = rustwasm.getInfo(12);

    stringPtr = rustwasm.getInfo(2);
    f32Ptr = rustwasm.getInfo(3);
    f32Len = rustwasm.getInfo(30);

    window.maxStr = () => { return rustwasm.getInfo(21); }

    const b = 1;
    const w = 4;
    const cv = document.getElementById("board");
    cv.width = (b + w) * uniX;
    cv.height = (b + w) * uniY;
    const contols = document.getElementById("contols");
    contols.style = `width: ${(b + w) * uniX}px;`;
    const canvas2d = cv.getContext("2d");
    for (const i of document.getElementsByClassName("life")) {
        i.hidden = false;
    }

    const pb = document.getElementById('pb');
    window.lifeupdate = () => {
        canvas2d.clearRect(0, 0, cv.width, cv.height);
        canvas2d.beginPath();
        let dead = true;
        const a = bufferCache.subarray(uniPtr, uniPtr + uniLen);
        for (let i = 0; i < uniX; i++) {
            for (let j = 0; j < uniY; j++) {
                if ((a[i + j * uniX] & 1) == 1) {
                    canvas2d.rect((b + w) * i, (b + w) * j, w, w);
                    dead = false;
                }
            }
        }
        if (dead) { stopLife(); }
        pb.disabled = dead;
        canvas2d.fillStyle = "white";
        canvas2d.fill();
    };

    window.addGlider = () => {
        let offsetX = Math.trunc((uniX - 4) * Math.random() + 2);
        let offsetY = Math.trunc((uniY - 4) * Math.random() + 2);
        let signX = Math.sign(Math.random() - 0.5);
        let signY = Math.sign(Math.random() - 0.5);
        rustwasm.toggleCell(offsetX + signX * 1, offsetY + signY * 0);
        rustwasm.toggleCell(offsetX + signX * 2, offsetY + signY * 1);
        rustwasm.toggleCell(offsetX + signX * 0, offsetY + signY * 2);
        rustwasm.toggleCell(offsetX + signX * 1, offsetY + signY * 2);
        rustwasm.toggleCell(offsetX + signX * 2, offsetY + signY * 2);
        lifeupdate();
    };

    window.addNoise = (amt) => {
        rustwasm.addNoiseToUniverse(amt);
        lifeupdate();
    }
    window.clearUni = () => {
        rustwasm.clearUniverse();
        lifeupdate();
    }


    // rustwasm.toggleCell(uniX - 1, uniY / 2);
    // rustwasm.toggleCell(uniX / 2, uniY - 1);

    window.handle = 0;
    let playing = false;
    window.play = () => {
        if (playing) {
            stopLife();
        } else {
            startLife();
        }
    }

    function startLife() {
        playing = true;
        pb.innerText = 'Pause';
        requestAnimationFrame(startLoop);
    }

    function stopLife() {
        playing = false;
        pb.innerText = 'Play';
    }

    let zero;
    function startLoop(timestamp) {
        zero = timestamp;
        requestAnimationFrame(loopLoop);
    }

    function loopLoop(timestamp) {
        if (timestamp - zero > 50) {
            rustwasm.tickUniverse()
            lifeupdate();
            zero = timestamp;
        }
        if (playing) {
            requestAnimationFrame((t) => { loopLoop(t) });
        }
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

        rustwasm.addNoiseToUniverse(0.3);
        lifecheck('Initial');
        lifeupdate();
        perfZero = performance.now();
        const cycles = 10000;
        for (let i = 0; i < cycles; i++) {
            rustwasm.tickUniverse();
        }

        console.log(`Simulated ${cycles} generations in ${performance.now() - perfZero}ms`);
        lifecheck('JS/WASM');
        lifeupdate();

        rustwasm.addNoiseToUniverse(0.7);
        lifecheck('Initial');
        lifeupdate();
        perfZero = performance.now();
        rustwasm.timeCrunch(cycles);

        console.log(`Crunched ${cycles} generations in ${performance.now() - perfZero}ms`);
        lifecheck('WASM');
        lifeupdate();
    };
}

function failure(error) { console.error(error); (document.getElementsByTagName('body'))[0].innerText = 'Parse error – unable to load WASM module!'; }