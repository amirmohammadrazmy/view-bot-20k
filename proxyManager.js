const axios = require('axios');
const { URL } = require('url');

// Final proxy source: A list of HTTP proxies from GitHub
const PROXY_LIST_URL = "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/countries/US/data.txt";

// URL for health-checking the proxies
const VALIDATION_URL = "https://2ad.ir/";
const VALIDATION_TIMEOUT = 10000; // 10 seconds

// In-memory cache for healthy, validated proxies
let proxyCache = [];
let proxyIndex = 0;

/**
 * Validates a single HTTP proxy by making a HEAD request to the validation URL.
 * This is a fast and efficient method for checking HTTP proxies.
 * @param {string} proxy - The proxy to validate, in http://ip:port format.
 * @returns {Promise<string|null>} The proxy string if healthy, otherwise null.
 */
async function validateProxy(proxy) {
    try {
        const proxyUrl = new URL(proxy);
        await axios.head(VALIDATION_URL, {
            proxy: {
                protocol: 'http',
                host: proxyUrl.hostname,
                port: parseInt(proxyUrl.port),
            },
            timeout: VALIDATION_TIMEOUT,
        });
        return proxy;
    } catch (error) {
        return null;
    }
}

/**
 * Fetches the list of proxies from the GitHub source, validates them concurrently,
 * and populates the cache with healthy proxies.
 */
async function fetchAndValidateProxies() {
    console.log(`⏳ Fetching HTTP proxy list from GitHub...`);
    try {
        const response = await axios.get(PROXY_LIST_URL, { timeout: 20000 });
        const rawProxies = response.data.trim().split('\n').filter(p => p.trim());

        if (rawProxies.length === 0) {
            console.warn("⚠️ The proxy list downloaded from GitHub is empty.");
            return;
        }

        const formattedProxies = rawProxies.map(p => `http://${p.trim()}`);
        console.log(`✔️ Found ${formattedProxies.length} raw proxies. Starting validation...`);

        const validationPromises = formattedProxies.map(validateProxy);
        const results = await Promise.all(validationPromises);
        const healthyProxies = results.filter(p => p !== null);

        if (healthyProxies.length === 0) {
            console.error("❌ None of the downloaded proxies passed the validation test.");
            return;
        }

        proxyCache = healthyProxies;
        proxyIndex = 0;
        proxyCache.sort(() => Math.random() - 0.5); // Shuffle for randomness
        console.log(`✅ Validation complete. ${proxyCache.length} healthy proxies are ready.`);

    } catch (error) {
        console.error(`❌ A critical error occurred while fetching/validating proxies: ${error.message}`);
    }
}

/**
 * Returns the next healthy proxy from the cache in a round-robin fashion.
 * @returns {string|null} A healthy proxy string, or null if the cache is empty.
 */
function getNextProxy() {
    if (proxyCache.length === 0) {
        console.warn("⚠️ Proxy cache is empty. Proceeding with a direct connection.");
        return null;
    }
    const proxy = proxyCache[proxyIndex];
    proxyIndex = (proxyIndex + 1) % proxyCache.length;
    return proxy;
}

module.exports = {
    fetchAndValidateProxies,
    getNextProxy,
};
