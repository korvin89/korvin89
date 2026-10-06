import type {ChartData} from '@gravity-ui/charts';

export type Theme = 'light' | 'dark';

export interface Stats {
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

const HALF_WIDTH = 412;

// One color per repository in every chart, taken from the default @gravity-ui/charts palette.
const REPO_COLORS: Record<string, string> = {
    uikit: '#4DA2F1',
    charts: '#FF3D64',
    chartkit: '#0FA08D',
};

const TITLE_STYLE = {fontSize: '15px', fontWeight: 600};
const CHART_OPTIONS = {margin: {top: 4, right: 12, bottom: 12, left: 4}};

// The category axis draws the first category at the bottom, so the list goes bottom-up
const REPOS = ['uikit', 'chartkit', 'charts'];
const REVIEWED_OPACITY = 0.35;
const DATA_LABEL_STYLE = {fontSize: '12px'};

function getAuthoredVsReviewedChart(stats: Stats): ChartData {
    const rows = REPOS.map((repo) => stats.authoredVsReviewed.find((item) => item.repo === repo)!);
    const authored = rows.reduce((sum, row) => sum + row.authored, 0);
    const reviewed = rows.reduce((sum, row) => sum + row.reviewed, 0);
    const getDataLabels = (suffix: string) => ({
        enabled: true,
        style: DATA_LABEL_STYLE,
        format: {type: 'custom' as const, formatter: ({value}: {value: unknown}) => `${value} ${suffix}`},
    });

    return {
        chart: CHART_OPTIONS,
        title: {
            text: `${reviewed.toLocaleString('en-US')} PRs reviewed · ${authored} authored`,
            style: TITLE_STYLE,
        },
        series: {
            // Each bar takes its repository color, reviewed bars are a lighter shade of it
            data: [
                {
                    type: 'bar-y',
                    name: 'authored',
                    dataLabels: getDataLabels('authored'),
                    data: rows.map(({repo, authored: x}) => ({y: repo, x, color: REPO_COLORS[repo]})),
                },
                {
                    type: 'bar-y',
                    name: 'reviewed',
                    dataLabels: getDataLabels('reviewed'),
                    data: rows.map(({repo, reviewed: x}) => ({
                        y: repo,
                        x,
                        color: REPO_COLORS[repo],
                        opacity: REVIEWED_OPACITY,
                    })),
                },
            ],
            options: {'bar-y': {barMaxWidth: 16}},
        },
        xAxis: {maxPadding: 0.3, labels: {enabled: false}, grid: {enabled: false}},
        yAxis: [{type: 'category', categories: REPOS}],
        legend: {enabled: false},
        tooltip: {enabled: false},
    };
}

function getNpmDownloadsChart(stats: Stats): ChartData {
    const {months, series} = stats.npmDownloads;
    const timestamps = months.map((month) => Date.parse(`${month}-01T00:00:00Z`));

    return {
        chart: CHART_OPTIONS,
        title: {text: 'npm downloads per month', style: TITLE_STYLE},
        series: {
            data: Object.entries(series).map(([packageName, values]) => {
                const repo = packageName.split('/')[1];
                const latest = Math.round(values[values.length - 1] / 1000);

                return {
                    type: 'line',
                    // The latest values of charts and chartkit are close, so labels at the line ends
                    // would overlap; the legend shows them instead.
                    name: `${repo} · ${latest}K`,
                    color: REPO_COLORS[repo],
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

export function getChartSpecs(stats: Stats): ChartSpec[] {
    return [
        {
            name: 'authored-vs-reviewed',
            width: HALF_WIDTH,
            height: 280,
            data: getAuthoredVsReviewedChart(stats),
        },
        {
            name: 'npm-downloads',
            width: HALF_WIDTH,
            height: 280,
            data: getNpmDownloadsChart(stats),
        },
    ];
}
