import type {ChartData} from '@gravity-ui/charts';

export type Theme = 'light' | 'dark';

export interface Stats {
    mergedPrs: {
        quarters: string[];
        series: Record<string, number[]>;
    };
    authoredVsReviewed: {repo: string; authored: number; reviewed: number}[];
    npmDownloads: {
        months: string[];
        series: Record<string, number[]>;
    };
}

export interface ChartSpec {
    name: string;
    width: number;
    height: number;
    data: ChartData;
}

const FULL_WIDTH = 840;
const HALF_WIDTH = 412;

// One color per repository in every chart, taken from the default @gravity-ui/charts palette.
const REPO_COLORS: Record<string, string> = {
    uikit: '#4DA2F1',
    charts: '#FF3D64',
    chartkit: '#0FA08D',
};
const OTHER_COLOR: Record<Theme, string> = {
    light: '#B3B8C0',
    dark: '#5E646E',
};

const TITLE_STYLE = {fontSize: '15px', fontWeight: 600};
const CHART_OPTIONS = {margin: {top: 4, right: 12, bottom: 12, left: 4}};

// '2024 Q3' -> timestamp of the middle of the quarter, so that year ticks fall between the bars
function getQuarterTimestamp(quarter: string) {
    const [year, index] = quarter.split(' Q').map(Number);

    return Date.UTC(year, (index - 1) * 3 + 1, 15);
}

function getRepoColor(repo: string, theme: Theme) {
    return REPO_COLORS[repo] ?? OTHER_COLOR[theme];
}

function getMergedPrsChart(stats: Stats, theme: Theme): ChartData {
    const {quarters, series} = stats.mergedPrs;
    const timestamps = quarters.map(getQuarterTimestamp);

    return {
        chart: CHART_OPTIONS,
        title: {text: 'My merged pull requests in Gravity UI by quarter', style: TITLE_STYLE},
        series: {
            data: Object.entries(series).map(([repo, values]) => ({
                type: 'bar-x',
                stacking: 'normal',
                name: repo,
                color: getRepoColor(repo, theme),
                data: values.map((y, index) => ({x: timestamps[index], y})),
            })),
        },
        xAxis: {type: 'datetime', labels: {dateFormat: 'YYYY'}, ticks: {interval: 160}},
        legend: {enabled: true},
        tooltip: {enabled: false},
    };
}

function getAuthoredVsReviewedChart(stats: Stats, theme: Theme): ChartData {
    const categories = ['Reviewed', 'Opened'];
    const firstYear = stats.mergedPrs.quarters[0].split(' ')[0];

    return {
        chart: CHART_OPTIONS,
        title: {text: `Merged PRs since ${firstYear}: opened vs reviewed`, style: TITLE_STYLE},
        series: {
            data: stats.authoredVsReviewed.map(({repo, authored, reviewed}) => ({
                type: 'bar-y',
                name: repo,
                color: getRepoColor(repo, theme),
                dataLabels: {enabled: true},
                data: [
                    {y: categories[0], x: reviewed},
                    {y: categories[1], x: authored},
                ],
            })),
            options: {'bar-y': {barMaxWidth: 20}},
        },
        xAxis: {maxPadding: 0.1},
        yAxis: [{type: 'category', categories}],
        legend: {enabled: true},
        tooltip: {enabled: false},
    };
}

function getNpmDownloadsChart(stats: Stats, theme: Theme): ChartData {
    const {months, series} = stats.npmDownloads;
    const timestamps = months.map((month) => Date.parse(`${month}-01T00:00:00Z`));

    return {
        chart: CHART_OPTIONS,
        title: {text: 'npm downloads per month', style: TITLE_STYLE},
        series: {
            data: Object.entries(series).map(([packageName, values]) => {
                const repo = packageName.split('/')[1];

                return {
                    type: 'line',
                    name: repo,
                    color: getRepoColor(repo, theme),
                    lineWidth: 2,
                    data: values.map((y, index) => ({x: timestamps[index], y})),
                };
            }),
        },
        xAxis: {type: 'datetime'},
        yAxis: [{labels: {numberFormat: {unit: 'k', precision: 0}}}],
        legend: {enabled: true},
        tooltip: {enabled: false},
    };
}

export function getChartSpecs(stats: Stats, theme: Theme): ChartSpec[] {
    return [
        {
            name: 'merged-prs',
            width: FULL_WIDTH,
            height: 300,
            data: getMergedPrsChart(stats, theme),
        },
        {
            name: 'authored-vs-reviewed',
            width: HALF_WIDTH,
            height: 280,
            data: getAuthoredVsReviewedChart(stats, theme),
        },
        {
            name: 'npm-downloads',
            width: HALF_WIDTH,
            height: 280,
            data: getNpmDownloadsChart(stats, theme),
        },
    ];
}
