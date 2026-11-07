/**
 * RPS/RPM counter middleware (O(1) complexity)
 */

let rpsCounter = 0;
let rpmCounter = 0;
let lastRpsReset = Date.now();
let lastRpmReset = Date.now();

function countRequest(req, res, next) {
    const now = Date.now();
    
    if (now - lastRpsReset >= 1000) {
        rpsCounter = 1;
        lastRpsReset = now;
    } else {
        rpsCounter++;
    }
    
    if (now - lastRpmReset >= 60000) {
        rpmCounter = 1;
        lastRpmReset = now;
    } else {
        rpmCounter++;
    }
    
    next();
}

function getStats() {
    // Counters reset lazily on next request; treat expired windows as zero.
    const now = Date.now();
    return {
        rps: (now - lastRpsReset >= 1000)  ? 0 : rpsCounter,
        rpm: (now - lastRpmReset >= 60000) ? 0 : rpmCounter,
    };
}

function reset() {
    rpsCounter = 0;
    rpmCounter = 0;
    lastRpsReset = Date.now();
    lastRpmReset = Date.now();
}

module.exports = { countRequest, getStats, reset };

