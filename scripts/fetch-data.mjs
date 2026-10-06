// Collects public stats for the profile README charts and writes data/stats.json.
// Only the gravity-ui organization is queried.

import {mkdir, writeFile} from 'node:fs/promises';

const USER = 'korvin89';
const ORG = 'gravity-ui';
const MAIN_REPOS = ['uikit', 'charts', 'chartkit'];
const NPM_PACKAGES = ['@gravity-ui/uikit', '@gravity-ui/charts', '@gravity-ui/chartkit'];
const NPM_MONTHS = 24;
const OUT_FILE = new URL('../data/stats.json', import.meta.url);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

async function getJson(url, headers = {}) {
    const response = await fetch(url, {headers});

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${url}`);
    }

    return response.json();
}

async function countMergedPrs(query) {
    const params = new URLSearchParams({q: `${query} type:pr is:merged`, per_page: '1'});
    const data = await getJson(`https://api.github.com/search/issues?${params}`, {
        accept: 'application/vnd.github+json',
        ...(token ? {authorization: `Bearer ${token}`} : {}),
    });

    return data.total_count;
}

function formatDate(date) {
    return date.toISOString().slice(0, 10);
}

// Monthly downloads for the last NPM_MONTHS full months.
// The npm API limits a range request to 18 months, so the period is requested in two halves.
async function getNpmDownloads(packageName, now) {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - NPM_MONTHS + 1, 1));
    const middle = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 12, 0));
    const afterMiddle = new Date(Date.UTC(middle.getUTCFullYear(), middle.getUTCMonth() + 1, 1));
    const ranges = [
        [start, middle],
        [afterMiddle, end],
    ];
    const byMonth = new Map();

    for (const [from, to] of ranges) {
        const data = await getJson(
            `https://api.npmjs.org/downloads/range/${formatDate(from)}:${formatDate(to)}/${packageName}`,
        );

        for (const {day, downloads} of data.downloads) {
            const month = day.slice(0, 7);
            byMonth.set(month, (byMonth.get(month) ?? 0) + downloads);
        }
    }

    return [...byMonth].sort(([a], [b]) => a.localeCompare(b));
}

const now = new Date();
const authoredVsReviewed = [];

for (const repo of MAIN_REPOS) {
    authoredVsReviewed.push({
        repo,
        authored: await countMergedPrs(`author:${USER} repo:${ORG}/${repo}`),
        reviewed: await countMergedPrs(`reviewed-by:${USER} -author:${USER} repo:${ORG}/${repo}`),
    });
}

const npmDownloads = {};
let months = [];

for (const packageName of NPM_PACKAGES) {
    const downloads = await getNpmDownloads(packageName, now);
    months = downloads.map(([month]) => month);
    npmDownloads[packageName] = downloads.map(([, value]) => value);
}

const stats = {
    authoredVsReviewed,
    npmDownloads: {months, series: npmDownloads},
};

await mkdir(new URL('.', OUT_FILE), {recursive: true});
await writeFile(OUT_FILE, `${JSON.stringify(stats, null, 2)}\n`);
console.log(`Saved stats: ${MAIN_REPOS.length} repositories, ${months.length} months of npm downloads`);
