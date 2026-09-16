document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const blockedDomain = urlParams.get("blocked");
    const safeDomain = urlParams.get("safeDomain");
    const finalScore = urlParams.get("finalScore");

    document.getElementById("safe-domain").textContent = `https://${safeDomain}`;
    document.getElementById("safe-domain").href = `https://${safeDomain}`;
    document.getElementById("blocked-domain").textContent = blockedDomain;
    document.getElementById("blocked-domain-link").href = `https://${blockedDomain}`;
    // document.getElementById("blocked-domain-owner").textContent = blockedDomain;
    const score = `${parseFloat(finalScore).toFixed(1)}%`;
    document.getElementById("final-score").textContent = score;
    document.body.style.setProperty('--score', score);

    // document.getElementById("proceed").addEventListener("click", () => {
    //     window.location.href = "https://" + blockedDomain;
    // });
    //
    // document.getElementById("redirect").addEventListener("click", () => {
    //     window.location.href = "https://" + safeDomain;
    // });

    document.getElementById("close").addEventListener("click", () => {
        setTimeout(window.close, 100)

    });
});
