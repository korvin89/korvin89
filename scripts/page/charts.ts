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

// Both charts list repositories in the same order, top to bottom
const REPOS_TOP_DOWN = ['uikit', 'chartkit', 'charts'];
const REVIEWED_OPACITY = 0.35;
const DATA_LABEL_STYLE = {fontSize: '12px'};

function getAuthoredVsReviewedChart(stats: Stats): ChartData {
    // The category axis draws the first category at the bottom
    const repos = [...REPOS_TOP_DOWN].reverse();
    const rows = repos.map((repo) => stats.authoredVsReviewed.find((item) => item.repo === repo)!);
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
        yAxis: [{type: 'category', categories: repos}],
        legend: {enabled: false},
        tooltip: {enabled: false},
    };
}

function getNpmDownloadsChart(stats: Stats): ChartData {
    const {months, series} = stats.npmDownloads;
    // A monthly total belongs to the middle of its month. This also keeps the first tick off the
    // left edge, where its label would be cut to an ellipsis with the y-axis labels hidden.
    const timestamps = months.map((month) => Date.parse(`${month}-15T00:00:00Z`));

    return {
        chart: CHART_OPTIONS,
        title: {text: 'npm downloads per month', style: TITLE_STYLE},
        series: {
            // The first area series lies at the top of the stack
            data: REPOS_TOP_DOWN.map((repo) => {
                const values = series[`@gravity-ui/${repo}`];
                const last = values.length - 1;

                return {
                    type: 'area',
                    stacking: 'normal',
                    name: repo,
                    color: REPO_COLORS[repo],
                    opacity: 0.6,
                    // Each label shows the latest value of its own package
                    data: values.map((y, index) => ({
                        x: timestamps[index],
                        y,
                        ...(index === last && {
                            marker: {states: {normal: {enabled: true}}},
                            annotation: {label: {text: `${repo} ${Math.round(y / 1000)}K`}},
                        }),
                    })),
                };
            }),
        },
        xAxis: {type: 'datetime', startOnTick: false, endOnTick: false},
        // chartkit depends on charts, so the stack height double counts installs
        // and the axis is hidden to keep that sum from reading as a total.
        yAxis: [{labels: {enabled: false}, grid: {enabled: false}}],
        legend: {enabled: false},
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
