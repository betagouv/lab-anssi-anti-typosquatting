import initSqlJs from "sql.js";


let rawDomains;

const levenshteinDistance = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(
                    dp[i - 1][j],     // Deletion
                    dp[i][j - 1],     // Insertion
                    dp[i - 1][j - 1]  // Substitution
                ) + 1;
            }
        }
    }
    return dp[a.length][b.length];
};

const dotProduct = (vec1, vec2) => {
    let sum = 0;
    for (const [gram, count] of vec1.entries()) {
        if (vec2.has(gram)) {
            sum += count * vec2.get(gram);
        }
    }
    return sum;
};

const magnitude = vec => Math.sqrt([...vec.values()].reduce((sum, count) => sum + count ** 2, 0));

const cosineSimilarity = (domainVec, safeVec) => {
    const numerator = dotProduct(domainVec, safeVec);
    const denominator = magnitude(domainVec) * magnitude(safeVec);
    return numerator / denominator;
};

const getDomain = url => {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return null;
    }
};

const getNGrams = (str, n = 2) => {
    const grams = [];
    for (let i = 0; i < str.length - n + 1; i++) {
        grams.push(str.slice(i, i + n));
    }
    return grams;
};

const vectorizeDomain = domain => {
    const grams = getNGrams(domain, 2);
    const freqMap = new Map();

    for (const gram of grams) {
        freqMap.set(gram, (freqMap.get(gram) || 0) + 1);
    }

    return freqMap;
};

// const safeDomains = ["google.com", "facebook.com", "amazon.fr"].map(domain => ({
//     domain,
//     vector: vectorizeDomain(domain)
// }));

// const safeDomains = domains.map(domain => ({
//     domain,
//     vector: vectorizeDomain(domain)
// }));

// const vectorize = str => {
//     const vec = Array(26).fill(0);
//     for (const ch of str.toLowerCase()) {
//         const i = ch.charCodeAt(0) - 97;
//         if (i >= 0 && i < 26) vec[i]++;
//     }
//     return new Uint8Array(vec);
// };

const shouldBlockDomain = domain => {
    // if(!db) return;

    if(!rawDomains) return;
    console.log("⏳ Checking domain", domain)
    const unknownVec = vectorizeDomain(domain);

    const safeDomains = rawDomains.map(domain => ({
        domain,
        vector: vectorizeDomain(domain)
    }));
    // const unknownVec = vectorize(domain);
    // const result = db.exec(`SELECT domain,
    //                    cosine_similarity(vector, ?) as cosine
    //             FROM domain_whitelist
    //             ORDER BY cosine DESC
    //             LIMIT 1;
    // `, [unknownVec]);
    // const result = db.exec(`SELECT domain,
    //            levenshtein(domain, ?) as levenshtein
    //     FROM domain_whitelist
    //     LIMIT 1;
    // `, [domain]);
    // console.log(result)

    for (const {domain: safeDomain, vector} of safeDomains) {
        // try {
        //     const stmt = db.exec(`
        //         SELECT domain,
        //                cosine_similarity(vector, ?) as cosine,
        //                levenshtein(domain, ?)       as lev
        //         FROM domain_whitelist
        //         ORDER BY cosine DESC, lev ASC
        //         LIMIT 1;
        //     `, [unknownVec, do]);
        //     stmt.bind([unknownVec, domain]);
        //     if (stmt.step()) {
        //         const row = stmt.getAsObject();
        //         console.log("Closest match:", row);
        //         return row;
        //     }
        // } catch(e) {
        //     console.warn(e);
        //     break;
        // }

        const cosine = cosineSimilarity(unknownVec, vector);

        const levDist = levenshteinDistance(domain, safeDomain);
        const maxLen = Math.max(domain.length, safeDomain.length);
        const levScore = 1 - levDist / maxLen;

        const finalScore = (cosine + levScore) / 2;

        if (finalScore > 0.85 && domain !== safeDomain) {
            console.log(finalScore);
            return { safeDomain, finalScore };
        }
    }

    return null;
};

async function loadDb() {
    const DB_URL = "http://localhost:8080/db.sqlite";

    let response = await fetch(DB_URL);
    if (!response.ok) {
        throw new Error("❌ Cannot fetch database.");
    }
    const buffer = await response.arrayBuffer();

    const SQLite = await initSqlJs({
        locateFile: () => browser.runtime.getURL("lib/sql-wasm.wasm")
    });
    const db = new SQLite.Database(new Uint8Array(buffer));

    rawDomains = db.exec("SELECT domain FROM domain_whitelist;")[0].values.map(v => v[0]);
    console.log('✅ Database loaded.');

    // const cosineSimilarity = (vecA, vecB) => {
    //     let dot = 0, magA = 0, magB = 0;
    //     for (let i = 0; i < vecA.length; i++) {
    //         dot += vecA[i] * vecB[i];
    //         magA += vecA[i] * vecA[i];
    //         magB += vecB[i] * vecB[i];
    //     }
    //     return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    // };
    // db.create_function("cosine_similarity", (v1, v2) => {
    //     const a = v1.split(",").map(Number);
    //     const b = v2.split(",").map(Number);
    //     return cosineSimilarity(a, b);
    // });
    // console.log('✅ Cosine similarity function created.');
    //
    // db.create_function("levenshtein", (a, b) => {
    //     const dp = Array.from({ length: a.length + 1 }, () => []);
    //     for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    //     for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    //     for (let i = 1; i <= a.length; i++) {
    //         for (let j = 1; j <= b.length; j++) {
    //             if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
    //             else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    //         }
    //     }
    //     return dp[a.length][b.length];
    // });
    // console.log('✅ Levenshtein function created.');
}

browser.runtime.onStartup.addListener(loadDb);
browser.runtime.onInstalled.addListener(loadDb);

browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        const domain = getDomain(details.url);
        const safeDomain = shouldBlockDomain(domain);
        if (domain && safeDomain) {
            const result = (safeDomain.finalScore * 100).toFixed(1);
            browser.tabs.create({
                url: browser.runtime.getURL(`popup.html?blocked=${domain}&safeDomain=${safeDomain.safeDomain}&finalScore=${result}`)
            });
            return { cancel: true };
        }
        return { cancel: false };
    },
    {
        urls: ["<all_urls>"],
        types: ["main_frame"]
    },
    ["blocking"]
);
