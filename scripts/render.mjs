// Renders the README charts with @gravity-ui/charts in a headless browser
// and saves them as standalone SVG files, one per chart and theme.

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

import {build} from 'esbuild';
import {chromium} from 'playwright';

const THEMES = ['light', 'dark'];
const STATS_FILE = new URL('../data/stats.json', import.meta.url);
const ASSETS_DIR = new URL('../assets/', import.meta.url);

async function buildPage() {
    const result = await build({
        entryPoints: [fileURLToPath(new URL('./page/index.tsx', import.meta.url))],
        bundle: true,
        write: false,
        outdir: 'out',
        format: 'iife',
        jsx: 'automatic',
        minify: true,
        define: {'process.env.NODE_ENV': '"production"'},
        loader: {'.woff': 'empty', '.woff2': 'empty'},
        logLevel: 'warning',
    });
    const getOutput = (extension) =>
        result.outputFiles.find((file) => file.path.endsWith(extension)).text;

    return `<!doctype html>
<html>
<head><meta charset="utf-8"><style>${getOutput('.css')}</style></head>
<body><div id="root"></div><script>${getOutput('.js')}</script></body>
</html>`;
}

const stats = JSON.parse(await readFile(STATS_FILE, 'utf8'));
const html = await buildPage();
const browser = await chromium.launch();

try {
    await mkdir(ASSETS_DIR, {recursive: true});

    for (const theme of THEMES) {
        const page = await browser.newPage({
            viewport: {width: 1000, height: 1000},
            timezoneId: 'UTC',
        });
        page.on('pageerror', (error) => {
            throw error;
        });
        await page.setContent(html);

        const charts = await page.evaluate(
            ([pageStats, pageTheme]) => window.renderCharts(pageStats, pageTheme),
            [stats, theme],
        );

        for (const [name, svg] of Object.entries(charts)) {
            await writeFile(new URL(`${name}-${theme}.svg`, ASSETS_DIR), `${svg}\n`);
        }

        await page.close();
    }
} finally {
    await browser.close();
}

console.log(`Rendered charts to ${fileURLToPath(ASSETS_DIR)}`);
