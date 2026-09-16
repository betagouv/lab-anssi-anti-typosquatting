import fs from "fs";
import initSqlJs from "../lib/sql.js";

const buffer = await fs.readFileSync("db.sql");

const SQLite = await initSqlJs();
const db = new SQLite.Database(new Uint8Array(buffer));

const result = db.exec("SELECT domain FROM domain_whitelist LIMIT 5;");
if (result.length > 0) {
    // const firstDomain = result[0].values[0][0];
    console.log(result[0].values.map(v => v[0]))
} else {
    console.log("No domains found.");
}