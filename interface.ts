// interface declarations

declare global {
    interface Window {
        addGlider: () => void;
        addLWSS: () => void;
        addNoise: (amt: number) => void;
        clearUni: () => void;
        render_frame: () => void;
        maxStr: () => number;
        play: () => void;
        runLife: () => void;
        rustwasm: WasmExports;
    }
}
export interface WasmExports {
    addNoiseToUniverse: (density: number) => void;
    clearUniverse: () => void;
    getInfo: (index: number) => number;
    memory: WebAssembly.Memory;
    tickUniverse: () => void;
    timeCrunch: (gens: number) => void;
    toggleCell: (x: number, y: number) => void;
    popCount: () => number;
}
export interface WasmImports {
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
