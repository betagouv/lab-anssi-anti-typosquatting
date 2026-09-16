import fs from "fs";
import initSqlJs from "../lib/sql-wasm.js";

const data = JSON.parse(fs.readFileSync("./communes.json", "utf-8"));

const domains = new Set(
    data
        .map(d => d.website_domain)
        .filter(d => !!d)
        .map(d => d.replace('www.', ''))
);
console.log(`Found ${domains.size} domains`);

// fs.writeFileSync('db.json', JSON.stringify([...domains]));

const SQLite = await initSqlJs({
     locateFile: filename => "../lib/sql-wasm.wasm"
});
let db = new SQLite.Database();

const vectorize = str => {
    const vec = Array(26).fill(0);
    for (const ch of str.toLowerCase()) {
        const i = ch.charCodeAt(0) - 97;
        if (i >= 0 && i < 26) vec[i]++;
    }
    return new Uint8Array(vec);
};

db.run("CREATE TABLE domain_whitelist (domain TEXT PRIMARY KEY, vector BLOB);");
db.run("BEGIN TRANSACTION;");
for (const domain of domains) {
    const vec = vectorize(domain);
    db.run("INSERT INTO domain_whitelist (domain, vector) VALUES (?, ?);", [domain, vec]);
}
db.run("COMMIT;");

const binDB = db.export();

fs.writeFileSync('db.sqlite', binDB);