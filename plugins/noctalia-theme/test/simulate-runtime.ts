import vm from "node:vm"

// Simulates the Seanime plugin runtime:
//   - the source is loaded in the loader runtime (RunString)
//   - init() is called in the loader runtime (RunString("init();"))
//   - the callback registered with $ui.register runs LATER, in the uiVM
// The two runtimes do not share lexical scope, which is why a plugin cannot
// close over constants declared outside the $ui.register callback.
const payload = await Bun.file(process.argv[2]).text()
const t = new Bun.Transpiler({ loader: "ts", target: "es2018", minifyWhitespace: true, minifySyntax: true })
const js = t.transformSync(payload)

let callback: any = null

const loader = vm.createContext({
    $ui: { register: (cb: any) => { callback = cb } },
    $storage: { get: () => undefined, set: () => {} },
    $os: { homeDir: () => "/home/seanime" },
    setTimeout: () => 0,
    clearTimeout: () => {},
})

try {
    vm.runInContext(js, loader)
    console.log("1. el source compila y evalua: OK")
} catch (e: any) {
    console.log("1. FALLO al evaluar el source:", e.message)
    process.exit(1)
}

try {
    vm.runInContext("init();", loader)
    console.log("2. init(): OK | callback registrado:", typeof callback === "function")
} catch (e: any) {
    console.log("2. init() FALLO:", e.message)
    process.exit(1)
}

// The uiVM is a separate runtime: only what the callback closes over is carried.
const uiVM = vm.createContext({
    $storage: { get: () => undefined, set: () => {} },
    $os: { homeDir: () => "/home/seanime" },
    setTimeout: () => 0,
    clearTimeout: () => {},
    DOMElement: function () {},
})

const ctx = {
    state: () => ({ get: () => "", set: () => {} }),
    fieldRef: () => ({ current: "", setValue: () => {}, onValueChange: () => {} }),
    newTray: () => { throw new Error("tray unavailable in this runtime") },
    dom: {
        onReady: () => {},
        queryOne: async () => null,
        createElement: async () => ({ setAttribute: () => {}, setText: () => {}, append: () => {} }),
    },
    setTimeout: () => 0,
    fetch: async () => ({ ok: false, status: 404, text: () => "" }),
}

try {
    callback.call(uiVM, ctx)
    console.log("3. el callback en el uiVM: OK")
} catch (e: any) {
    console.log("3. el callback en el uiVM FALLO:", e.message)
    process.exit(1)
}
