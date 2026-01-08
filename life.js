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
            now: () => performance.now(),
        },
    })
        .then(main)
        .catch(failure);
};
function failure(error) {
    console.error(error);
    document.getElementsByTagName("body")[0].innerText =
        "Parse error - unable to load WASM module!";
}
let uint8Cache;
function memoryBuffer(ptr, len) {
    let output;
    try {
        output = uint8Cache.subarray(ptr, ptr + len);
    }
    catch {
        uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);
        output = uint8Cache.subarray(ptr, ptr + len);
    }
    return output;
}
const niceDecoder = new TextDecoder();
let stringPtr;
function makeString(len) {
    return niceDecoder.decode(memoryBuffer(stringPtr, len));
}
function main(result) {
    console.log(`WASM loaded! ${performance.now() - perfZero}ms`);
    window.rustwasm = result.instance.exports;
    function getInfo(x) {
        const data = window.rustwasm.getInfo(x);
        if (data == -999) {
            return null;
        }
        return data;
    }
    const uniPtr = getInfo(1);
    const uniLen = getInfo(10);
    const uniX = getInfo(11);
    const uniY = getInfo(12);
    stringPtr = getInfo(2);
    window.maxStr = () => getInfo(21);
    const cellGap = 1;
    const cellWidth = 4;
    const canvas = document.getElementById("canvas");
    canvas.width = (cellGap + cellWidth) * uniX - cellGap + 2;
    canvas.height = (cellGap + cellWidth) * uniY - cellGap + 2;
    const controls = document.getElementById("controls");
    controls.style = `width: ${(cellGap + cellWidth) * uniX}px;`;
    const canvas2d = canvas.getContext("2d");
    const playButton = document.getElementById("playButton");
    playButton.disabled = true;
    for (const i of document.getElementsByClassName("life")) {
        i.hidden = false;
    }
    window.render_frame = () => {
        canvas2d.clearRect(0, 0, canvas.width, canvas.height);
        canvas2d.beginPath();
        let popcount = 0;
        const uni = memoryBuffer(uniPtr, uniLen);
        for (let i = 0; i < uniX; i++) {
            for (let j = 0; j < uniY; j++) {
                if ((uni[i + j * uniX] & 1) == 1) {
                    canvas2d.rect(1 + (cellGap + cellWidth) * i, 1 + (cellGap + cellWidth) * j, cellWidth, cellWidth);
                    popcount++;
                }
            }
        }
        canvas2d.fillStyle = "white";
        canvas2d.fill();
        if (popcount == 0) {
            stopLife();
        }
        playButton.disabled = popcount == 0;
        return popcount;
    };
    function add(iter) {
        const offset = function (x) {
            return Math.trunc((x - 4) * Math.random() + 2);
        };
        const sign = function () {
            return Math.sign(Math.random() - 0.5);
        };
        const [offsetX, offsetY] = [offset(uniX), offset(uniY)];
        const [signX, signY] = [sign(), sign()];
        for (let [a, b] of iter) {
            window.rustwasm.toggleCell(offsetX + signX * a, offsetY + signY * b);
        }
        window.render_frame();
    }
    window.addLWSS = () => {
        add([
            [
                [0, 3],
                [1, 4],
                [2, 0],
                [2, 4],
                [3, 1],
                [3, 2],
                [3, 3],
                [3, 4],
            ],
            [
                [3, 0],
                [4, 1],
                [0, 2],
                [4, 2],
                [1, 3],
                [2, 3],
                [3, 3],
                [4, 3],
            ],
        ][Math.floor(Math.random() * 2)]);
    };
    window.addGlider = () => {
        add([
            [
                [0, 2],
                [1, 0],
                [1, 2],
                [2, 1],
                [2, 2],
            ],
            [
                [0, 0],
                [1, 1],
                [1, 2],
                [2, 0],
                [2, 1],
            ],
        ][Math.floor(Math.random() * 2)]);
    };
    window.addNoise = (amt) => {
        window.rustwasm.addNoiseToUniverse(amt);
        window.render_frame();
    };
    window.clearUni = () => {
        window.rustwasm.clearUniverse();
        window.render_frame();
    };
    let playing = false;
    window.play = () => {
        if (playing) {
            stopLife();
        }
        else {
            playing = true;
            playButton.innerText = "Pause";
            requestAnimationFrame(startLoop);
        }
    };
    function stopLife() {
        playing = false;
        playButton.innerText = "Play";
    }
    let t_zero;
    function startLoop(timestamp) {
        t_zero = timestamp;
        requestAnimationFrame(loopLoop);
    }
    function loopLoop(timestamp) {
        if (timestamp - t_zero > 50) {
            window.rustwasm.tickUniverse();
            window.render_frame();
            t_zero = timestamp;
        }
        if (playing) {
            requestAnimationFrame((t) => {
                loopLoop(t);
            });
        }
    }
}
export {};
