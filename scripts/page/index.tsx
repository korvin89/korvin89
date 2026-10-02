import React from 'react';

import {Chart} from '@gravity-ui/charts';
import {ThemeProvider} from '@gravity-ui/uikit';
import {createRoot} from 'react-dom/client';

import {getChartSpecs} from './charts';
import type {Stats, Theme} from './charts';
import {exportSvg} from './export-svg';

import '@gravity-ui/uikit/styles/styles.css';
import './styles.css';

declare global {
    interface Window {
        renderCharts: (stats: Stats, theme: Theme) => Promise<Record<string, string>>;
    }
}

// Renders every chart for the given theme and resolves with standalone SVG markup by chart name.
window.renderCharts = (stats, theme) => {
    const specs = getChartSpecs(stats, theme);
    const container = document.getElementById('root') as HTMLElement;
    const root = createRoot(container);

    return new Promise((resolve) => {
        const ready = new Set<string>();
        const handleReady = (name: string) => {
            ready.add(name);

            if (ready.size < specs.length) {
                return;
            }

            // onReady fires before the last paint is committed to the DOM
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const result: Record<string, string> = {};

                    for (const spec of specs) {
                        const node = container.querySelector(`[data-chart="${spec.name}"] svg`);
                        result[spec.name] = exportSvg(node as SVGSVGElement);
                    }

                    root.unmount();
                    resolve(result);
                });
            });
        };

        root.render(
            <ThemeProvider theme={theme}>
                {specs.map((spec) => (
                    <div
                        key={spec.name}
                        data-chart={spec.name}
                        style={{width: spec.width, height: spec.height}}
                    >
                        <Chart data={spec.data} onReady={() => handleReady(spec.name)} />
                    </div>
                ))}
            </ThemeProvider>,
        );
    });
};
