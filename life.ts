let wasmName: string = "demo.wasm";
let perfZero: number = performance.now();

declare global {
    interface Window {
        addGlider: () => void;
        addNoise: (amt: number) => void;
        clearUni: () => void;
        lifeupdate: () => void;
        maxStr: () => number;
        play: () => void;
        runLife: () => void;
        rustwasm: WasmExports;
    }
}

interface WasmExports {
    addNoiseToUniverse: (density: number) => void;
    clearUniverse: () => void;
    getInfo: (index: number) => number;
    memory: WebAssembly.Memory;
    tickUniverse: () => void;
    timeCrunch: (gens: number) => void;
    toggleCell: (x: number, y: number) => void;
}

interface WasmImports {
    console: typeof console;
    math: typeof Math;
    window: typeof window;
    shim: {
        error: (len: number) => void;
        info: (len: number) => void;
        log: (len: number) => void;
        warn: (len: number) => void;
        now: () => number;
    };
    [key: string]: any;
}

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
            now: (): number => performance.now()
        },
    } as WasmImports)
        .then(main)
        .catch(failure);
};

const niceDecoder = new TextDecoder;
let uint8Cache: Uint8Array<ArrayBuffer>;
let stringPtr: number;

function makeString(len: number): string {
    if (uint8Cache.buffer.detached) {
        console.warn("makestring: buffer detached, renewing...");
        uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);
    }
    return niceDecoder.decode(uint8Cache.subarray(stringPtr, stringPtr + len));
}

function main(result: WebAssembly.WebAssemblyInstantiatedSource) {
    console.log(`WASM loaded! ${performance.now() - perfZero}ms`);
    window.rustwasm = result.instance.exports as unknown as WasmExports;

    uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);

    const uniPtr: number = window.rustwasm.getInfo(1);
    const uniLen: number = window.rustwasm.getInfo(10);
    const uniX: number = window.rustwasm.getInfo(11);
    const uniY: number = window.rustwasm.getInfo(12);

    stringPtr = window.rustwasm.getInfo(2);

    window.maxStr = (): number => window.rustwasm.getInfo(21);

    const cellGap: number = 1;
    const cellWidth: number = 4;

    const cv = document.getElementById("board") as HTMLCanvasElement;
    cv.width = (cellGap + cellWidth) * uniX - cellGap + 2;
    cv.height = (cellGap + cellWidth) * uniY - cellGap + 2;

    const contols = document.getElementById("contols") as HTMLElement;
    contols.style = `width: ${(cellGap + cellWidth) * uniX}px;`;

    const canvas2d = cv.getContext("2d") as CanvasRenderingContext2D;

    for (const i of document.getElementsByClassName("life")) {
        (i as HTMLElement).hidden = false;
    }

    const pb = document.getElementById('pb') as HTMLButtonElement;
    window.lifeupdate = (): number => {
        canvas2d.clearRect(0, 0, cv.width, cv.height);
        canvas2d.beginPath();
        let popcount: number = 0;
        if (uint8Cache.buffer.detached) {
            console.warn("lifeupdate: buffer detached, renewing...");
            uint8Cache = new Uint8Array(window.rustwasm.memory.buffer);
        }
        const a = uint8Cache.subarray(uniPtr, uniPtr + uniLen);
        for (let i = 0; i < uniX; i++) {
            for (let j = 0; j < uniY; j++) {
                if ((a[i + j * uniX] & 1) == 1) {
                    canvas2d.rect(
                        1 + (cellGap + cellWidth) * i,
                        1 + (cellGap + cellWidth) * j,
                        cellWidth,
                        cellWidth
                    );
                    popcount++;
                }
            }
        }
        if (popcount == 0) { stopLife(); }
        pb.disabled = popcount == 0;
        canvas2d.fillStyle = "white";
        canvas2d.fill();
        return popcount;
    };

    window.addGlider = (): void => {
        // find where and how to draw the glider
        let offsetX: number = Math.trunc((uniX - 4) * Math.random() + 2);
        let offsetY: number = Math.trunc((uniY - 4) * Math.random() + 2);
        let signX: number = Math.sign(Math.random() - 0.5);
        let signY: number = Math.sign(Math.random() - 0.5);

        // draw the glider's pixels
        for (let i = 0; i < 5; i++) {
            let [a, b] = [[0, 2], [1, 0], [1, 2], [2, 1], [2, 2]][i];
            window.rustwasm.toggleCell(offsetX + signX * a, offsetY + signY * b);
        }

        // refresh the view
        window.lifeupdate();
    };

    window.addNoise = (amt: number): void => {
        window.rustwasm.addNoiseToUniverse(amt);
        window.lifeupdate();
    }
    window.clearUni = (): void => {
        window.rustwasm.clearUniverse();
        window.lifeupdate();
    }

    let playing = false;
    window.play = (): void => {
        if (playing) {
            stopLife();
        } else {
            playing = true;
            pb.innerText = 'Pause';
            requestAnimationFrame(startLoop);
        }
    }

    function stopLife(): void {
        playing = false;
        pb.innerText = 'Play';
    }

    let t_zero: number;
    function startLoop(timestamp: number): void {
        t_zero = timestamp;
        requestAnimationFrame(loopLoop);
    }

    function loopLoop(timestamp: number): void {
        if (timestamp - t_zero > 50) {
            window.rustwasm.tickUniverse()
            window.lifeupdate();
            t_zero = timestamp;
        }
        if (playing) {
            requestAnimationFrame(t => { loopLoop(t) });
        }
    }
}

// on failure
function failure(error: string): void {
    console.error(error);
    (document.getElementsByTagName('body'))[0]
        .innerText = 'Parse error - unable to load WASM module!';
}

export { };
