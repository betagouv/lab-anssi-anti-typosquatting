export default function initSqlJsWrapper(config) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = browser.runtime.getURL("lib/sql-wasm.js");
        script.type = "text/javascript";
        script.onload = () => {
            if (self.initSqlJs) {
                self.initSqlJs(config).then(resolve, reject);
            } else {
                reject(new Error("initSqlJs not found on global scope"));
            }
        };
        script.onerror = () => reject(new Error("Failed to load sql-wasm.js"));
        document.documentElement.appendChild(script);
    });
}
