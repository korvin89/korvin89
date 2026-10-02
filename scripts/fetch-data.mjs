// Collects public stats for the profile README charts and writes data/stats.json.
// Only the gravity-ui organization is queried.

import {mkdir, writeFile} from 'node:fs/promises';

const USER = 'korvin89';
const ORG = 'gravity-ui';
// Repos that get their own series; everything else in the org is folded into "other".
const MAIN_REPOS = ['uikit', 'charts', 'chartkit'];
const NPM_PACKAGES = ['@gravity-ui/uikit', '@gravity-ui/charts'];
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

function searchIssues(query, page = 1) {
    const params = new URLSearchParams({q: query, per_page: '100', page: String(page)});

    return getJson(`https://api.github.com/search/issues?${params}`, {
        accept: 'application/vnd.github+json',
        ...(token ? {authorization: `Bearer ${token}`} : {}),
    });
}

function toQuarter(isoDate) {
    const date = new Date(isoDate);

    return `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

function quartersBetween(first, last) {
    const result = [];
    let [year, quarter] = first.split(' Q').map(Number);

    for (;;) {
        const key = `${year} Q${quarter}`;
        result.push(key);

        if (key === last) {
            return result;
        }

        quarter += 1;

        if (quarter > 4) {
            quarter = 1;
            year += 1;
        }
    }
}

async function getMergedPrs() {
    const query = `author:${USER} org:${ORG} type:pr is:merged`;
    const items = [];

    for (let page = 1; ; page++) {
        const data = await searchIssues(query, page);
        items.push(...data.items);

        if (items.length >= data.total_count || data.items.length === 0) {
            break;
        }
    }

    return items.map((item) => ({
        repo: item.repository_url.split('/').pop(),
        mergedAt: item.pull_request.merged_at ?? item.closed_at,
    }));
}

async function getReviewedCount(repo) {
    const data = await searchIssues(
        `reviewed-by:${USER} -author:${USER} repo:${ORG}/${repo} type:pr is:merged`,
    );

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
const prs = await getMergedPrs();
const repoNames = [...MAIN_REPOS, 'other'];
const prQuarters = prs.map((pr) => ({
    repo: MAIN_REPOS.includes(pr.repo) ? pr.repo : 'other',
    quarter: toQuarter(pr.mergedAt),
}));
const sortedQuarters = prQuarters.map((pr) => pr.quarter).sort();
// The current quarter is not over yet and would look like a drop, so the range ends at the previous one.
const lastFullQuarter = toQuarter(
    new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 0)).toISOString(),
);
const quarters = quartersBetween(sortedQuarters[0], lastFullQuarter);

const mergedByQuarter = Object.fromEntries(
    repoNames.map((repo) => [
        repo,
        quarters.map(
            (quarter) => prQuarters.filter((pr) => pr.repo === repo && pr.quarter === quarter).length,
        ),
    ]),
);

const authoredVsReviewed = [];

for (const repo of MAIN_REPOS) {
    authoredVsReviewed.push({
        repo,
        authored: prs.filter((pr) => pr.repo === repo).length,
        reviewed: await getReviewedCount(repo),
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
    mergedPrs: {total: prs.length, quarters, series: mergedByQuarter},
    authoredVsReviewed,
    npmDownloads: {months, series: npmDownloads},
};

await mkdir(new URL('.', OUT_FILE), {recursive: true});
await writeFile(OUT_FILE, `${JSON.stringify(stats, null, 2)}\n`);
console.log(`Saved stats: ${prs.length} merged PRs, ${quarters.length} quarters, ${months.length} months`);
