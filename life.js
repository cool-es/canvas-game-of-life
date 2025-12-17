let wasmName = "demo.wasm";
let perfZero = performance.now();
window.onload = function () {
    WebAssembly.instantiateStreaming(fetch(wasmName), {
        console: console,
        math: Math,
        window: window,
        shim: {
            error: (len) => console.error(makeString(len)),
            info: (len) => console.info(makeString(len)),
            log: (len) => console.log(makeString(len)),
            warn: (len) => console.warn(makeString(len)),
            now: () => performance.now()
        },
    })
        .then(main)
        .catch(failure);
};
const niceDecoder = new TextDecoder;
let uint8Cache;
let stringPtr;
function makeString(len) {
    if (uint8Cache.buffer.detached) {
        console.warn("makestring: buffer detached, renewing...");
        uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);
    }
    return niceDecoder.decode(uint8Cache.subarray(stringPtr, stringPtr + len));
}
function main(result) {
    console.log(`WASM loaded! ${performance.now() - perfZero}ms`);
    window.rustwasm = result.instance.exports;
    uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);
    const uniPtr = window.rustwasm.getInfo(1);
    const uniLen = window.rustwasm.getInfo(10);
    const uniX = window.rustwasm.getInfo(11);
    const uniY = window.rustwasm.getInfo(12);
    stringPtr = window.rustwasm.getInfo(2);
    window.maxStr = () => window.rustwasm.getInfo(21);
    const cellGap = 1;
    const cellWidth = 4;
    const cv = document.getElementById("board");
    if (!cv)
        throw new Error("Canvas element not found!");
    cv.width = (cellGap + cellWidth) * uniX - cellGap + 2;
    cv.height = (cellGap + cellWidth) * uniY - cellGap + 2;
    const contols = document.getElementById("contols");
    if (!contols)
        throw new Error("Canvas element not found!");
    contols.style = `width: ${(cellGap + cellWidth) * uniX}px;`;
    const canvas2d = cv.getContext("2d");
    if (!canvas2d)
        throw new Error("Canvas element not found!");
    for (const i of document.getElementsByClassName("life")) {
        i.hidden = false;
    }
    const pb = document.getElementById('pb');
    window.lifeupdate = () => {
        canvas2d.clearRect(0, 0, cv.width, cv.height);
        canvas2d.beginPath();
        let dead = true;
        if (uint8Cache.buffer.detached) {
            console.warn("lifeupdate: buffer detached, renewing...");
            uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);
        }
        const a = uint8Cache.subarray(uniPtr, uniPtr + uniLen);
        for (let i = 0; i < uniX; i++) {
            for (let j = 0; j < uniY; j++) {
                if ((a[i + j * uniX] & 1) == 1) {
                    canvas2d.rect(1 + (cellGap + cellWidth) * i, 1 + (cellGap + cellWidth) * j, cellWidth, cellWidth);
                    dead = false;
                }
            }
        }
        if (dead) {
            stopLife();
        }
        pb.disabled = dead;
        canvas2d.fillStyle = "white";
        canvas2d.fill();
    };
    window.addGlider = () => {
        let offsetX = Math.trunc((uniX - 4) * Math.random() + 2);
        let offsetY = Math.trunc((uniY - 4) * Math.random() + 2);
        let signX = Math.sign(Math.random() - 0.5);
        let signY = Math.sign(Math.random() - 0.5);
        for (let i = 0; i < 5; i++) {
            let [a, b] = [[0, 2], [1, 0], [1, 2], [2, 1], [2, 2]][i];
            window.rustwasm.toggleCell(offsetX + signX * a, offsetY + signY * b);
        }
        window.lifeupdate();
    };
    window.addNoise = (amt) => {
        window.rustwasm.addNoiseToUniverse(amt);
        window.lifeupdate();
    };
    window.clearUni = () => {
        window.rustwasm.clearUniverse();
        window.lifeupdate();
    };
    window.handle = 0;
    let playing = false;
    window.play = () => {
        if (playing) {
            stopLife();
        }
        else {
            startLife();
        }
    };
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
            window.rustwasm.tickUniverse();
            window.lifeupdate();
            zero = timestamp;
        }
        if (playing) {
            requestAnimationFrame(t => { loopLoop(t); });
        }
    }
    window.runLife = () => {
        window.rustwasm.addNoiseToUniverse(0.3);
        window.lifeupdate();
        perfZero = performance.now();
        const cycles = 10000;
        for (let i = 0; i < cycles; i++) {
            window.rustwasm.tickUniverse();
        }
        console.log(`Simulated ${cycles} generations in ${performance.now() - perfZero}ms`);
        window.lifeupdate();
        window.rustwasm.addNoiseToUniverse(0.7);
        window.lifeupdate();
        perfZero = performance.now();
        window.rustwasm.timeCrunch(cycles);
        console.log(`Crunched ${cycles} generations in ${performance.now() - perfZero}ms`);
        window.lifeupdate();
    };
}
function failure(error) {
    console.error(error);
    (document.getElementsByTagName('body'))[0]
        .innerText = 'Parse error - unable to load WASM module!';
}
export {};
