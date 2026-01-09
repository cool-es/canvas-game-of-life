import { WasmImports, WasmExports } from "./interface";

let wasmName: string = "demo.wasm";
let perfZero: number = performance.now();

window.onload = function (): void {
    WebAssembly.instantiateStreaming(fetch(wasmName), {
        console: console,
        math: Math,
        window: window,
        shim: {
            error: (len: number): void => console.error(makeString(len)),
            info: (len: number): void => console.info(makeString(len)),
            log: (len: number): void => console.log(makeString(len)),
            warn: (len: number): void => console.warn(makeString(len)),
            now: (): number => performance.now(),
        },
    } as WasmImports)
        .then(main)
        .catch(failure);
};

// on failure
function failure(error: string): void {
    console.error(error);
    document.getElementsByTagName("body")[0].innerText =
        "Parse error - unable to load WASM module!";
}

let uint8Cache: Uint8Array<ArrayBuffer>;
function memoryBuffer(ptr: number, len: number): Uint8Array<ArrayBuffer> {
    let output: Uint8Array<ArrayBuffer>;
    try {
        output = uint8Cache.subarray(ptr, ptr + len);
    } catch {
        // memory buffer is detached or uninitialized
        uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);
        output = uint8Cache.subarray(ptr, ptr + len);
    }
    return output;
}

const niceDecoder = new TextDecoder();
let stringPtr: number;
function makeString(len: number): string {
    return niceDecoder.decode(memoryBuffer(stringPtr, len));
}

function main(result: WebAssembly.WebAssemblyInstantiatedSource) {
    console.log(`WASM loaded! ${performance.now() - perfZero}ms`);
    window.rustwasm = result.instance.exports as unknown as WasmExports;

    function getInfo(x: number): number | null {
        const data = window.rustwasm.getInfo(x);
        if (data == -999) {
            return null;
        }
        return data;
    }

    const uniPtr: number = getInfo(1)!;
    const uniLen: number = getInfo(10)!;
    const uniX: number = getInfo(11)!;
    const uniY: number = getInfo(12)!;

    stringPtr = getInfo(2)!;

    window.maxStr = (): number => getInfo(21)!;

    const cellGap: number = 1;
    const cellWidth: number = 4;

    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    canvas.width = (cellGap + cellWidth) * uniX - cellGap + 2;
    canvas.height = (cellGap + cellWidth) * uniY - cellGap + 2;

    const controls = document.getElementById("controls") as HTMLElement;
    controls.style = `width: ${(cellGap + cellWidth) * uniX}px;`;

    const canvas2d = canvas.getContext("2d") as CanvasRenderingContext2D;

    // identify and disable play button on page load
    const playButton = document.getElementById("playButton") as HTMLButtonElement;
    playButton.disabled = true;

    // unhide page elements on successful page load (hidden by default)
    for (const i of document.getElementsByClassName("life")) {
        (i as HTMLElement).hidden = false;
    }

    // render frame to canvas element
    window.render_frame = (): void => {
        canvas2d.clearRect(0, 0, canvas.width, canvas.height);
        canvas2d.beginPath();

        const popcount = window.rustwasm.popCount();
        if (popcount != 0) {
            const uni = memoryBuffer(uniPtr, uniLen);

            for (let i = 0; i < uniX; i++) {
                for (let j = 0; j < uniY; j++) {
                    if ((uni[i + j * uniX] & 1) == 1) {
                        canvas2d.rect(
                            1 + (cellGap + cellWidth) * i,
                            1 + (cellGap + cellWidth) * j,
                            cellWidth,
                            cellWidth
                        );
                    }
                }
            }

            playButton.disabled = false;
        } else {
            stopLife();
            playButton.disabled = true;
        }

        canvas2d.fillStyle = "white";
        canvas2d.fill();
    };

    type Coords = Iterable<number[]>;

    // Add a pattern to the playing field from an iterator.
    function add(iter: Coords): void {
        // find where and how to draw it
        const offset = function (x: number): number {
            return Math.trunc((x - 4) * Math.random() + 2);
        };
        const sign = function (): number {
            return Math.sign(Math.random() - 0.5);
        };
        const [offsetX, offsetY] = [offset(uniX), offset(uniY)];
        const [signX, signY] = [sign(), sign()];

        for (let [a, b] of iter) {
            window.rustwasm.toggleCell(offsetX + signX * a, offsetY + signY * b);
        }

        // refresh the view
        window.render_frame();
    }

    window.addLWSS = (): void => {
        add(
            [
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
            ][Math.floor(Math.random() * 2)]
        );
    };

    window.addGlider = (): void => {
        add(
            [
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
            ][Math.floor(Math.random() * 2)]
        );
    };

    window.addNoise = (amt: number): void => {
        window.rustwasm.addNoiseToUniverse(amt);
        window.render_frame();
    };
    window.clearUni = (): void => {
        window.rustwasm.clearUniverse();
        window.render_frame();
    };

    let t_zero: number;
    let playing = false;
    window.play = (): void => {
        if (playing) {
            stopLife();
        } else {
            playing = true;
            playButton.innerText = "Pause";
            requestAnimationFrame((timestamp: number): void => {
                t_zero = timestamp;
                requestAnimationFrame(loop);
            });
        }
    };

    function stopLife(): void {
        playing = false;
        playButton.innerText = "Play";
    }

    function loop(timestamp: number): void {
        if (timestamp - t_zero > 50) {
            window.rustwasm.tickUniverse();
            window.render_frame();
            t_zero = timestamp;
        }
        if (playing) {
            requestAnimationFrame(loop);
        }
    }
}

export {};
