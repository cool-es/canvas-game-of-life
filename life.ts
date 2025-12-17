let wasmName: string = "demo.wasm";
let perfZero: number = performance.now();

declare global {
    interface Window {
        addGlider: () => void;
        addNoise: (amt: number) => void;
        clearUni: () => void;
        handle: number;
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

    const uniPtr = window.rustwasm.getInfo(1);
    const uniLen = window.rustwasm.getInfo(10);
    const uniX = window.rustwasm.getInfo(11);
    const uniY = window.rustwasm.getInfo(12);

    stringPtr = window.rustwasm.getInfo(2);

    window.maxStr = (): number => window.rustwasm.getInfo(21);

    const cellGap = 1;
    const cellWidth = 4;

    const cv = document.getElementById("board") as HTMLCanvasElement;
    if (!cv) throw new Error("Canvas element not found!");
    cv.width = (cellGap + cellWidth) * uniX - cellGap + 2;
    cv.height = (cellGap + cellWidth) * uniY - cellGap + 2;

    const contols = document.getElementById("contols");
    if (!contols) throw new Error("Canvas element not found!");
    contols.style = `width: ${(cellGap + cellWidth) * uniX}px;`;

    const canvas2d = cv.getContext("2d");
    if (!canvas2d) throw new Error("Canvas element not found!");

    for (const i of document.getElementsByClassName("life")) {
        (i as HTMLElement).hidden = false;
    }

    const pb = document.getElementById('pb') as HTMLButtonElement;
    window.lifeupdate = (): void => {
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
        if (dead) { stopLife(); }
        pb.disabled = dead;
        canvas2d.fillStyle = "white";
        canvas2d.fill();
    };

    window.addGlider = (): void => {
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

    window.addNoise = (amt): void => {
        window.rustwasm.addNoiseToUniverse(amt);
        window.lifeupdate();
    }
    window.clearUni = (): void => {
        window.rustwasm.clearUniverse();
        window.lifeupdate();
    }

    window.handle = 0;
    let playing = false;
    window.play = (): void => {
        if (playing) {
            stopLife();
        } else {
            startLife();
        }
    }

    function startLife(): void {
        playing = true;
        pb.innerText = 'Pause';
        requestAnimationFrame(startLoop);
    }

    function stopLife(): void {
        playing = false;
        pb.innerText = 'Play';
    }

    let zero: number;
    function startLoop(timestamp: number): void {
        zero = timestamp;
        requestAnimationFrame(loopLoop);
    }

    function loopLoop(timestamp: number): void {
        if (timestamp - zero > 50) {
            window.rustwasm.tickUniverse()
            window.lifeupdate();
            zero = timestamp;
        }
        if (playing) {
            requestAnimationFrame(t => { loopLoop(t) });
        }
    }

    window.runLife = (): void => {
        function lifecheck(str: string): void {
            const a = uint8Cache.subarray(uniPtr, uniPtr + uniLen);
            let count = 0;
            for (const i in a) { if ((a[i] & 1) == 1) { count++; } }
            console.log(`${str} - population count: ${count} (${Math.round((1000 * count) / uniLen) / 10}%)`);
        }

        // fill universe with white noise
        window.rustwasm.addNoiseToUniverse(0.3);
        lifecheck('Initial');
        window.lifeupdate();
        perfZero = performance.now();
        const cycles = 10000;
        for (let i = 0; i < cycles; i++) {
            window.rustwasm.tickUniverse();
        }

        console.log(`Simulated ${cycles} generations in ${performance.now() - perfZero}ms`);
        lifecheck('JS/WASM');
        window.lifeupdate();

        window.rustwasm.addNoiseToUniverse(0.7);
        lifecheck('Initial');
        window.lifeupdate();
        perfZero = performance.now();
        window.rustwasm.timeCrunch(cycles);

        console.log(`Crunched ${cycles} generations in ${performance.now() - perfZero}ms`);
        lifecheck('WASM');
        window.lifeupdate();
    };
}

// on failure
function failure(error: string): void {
    console.error(error);
    (document.getElementsByTagName('body'))[0]
        .innerText = 'Parse error - unable to load WASM module!';
}

export { };
