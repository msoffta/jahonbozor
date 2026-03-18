import { useMemo } from "react";

function resolveColor(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

export function useChartColors() {
    return useMemo(
        () => ({
            chart1: resolveColor("chart-1"),
            chart2: resolveColor("chart-2"),
            chart3: resolveColor("chart-3"),
            chart4: resolveColor("chart-4"),
            chart5: resolveColor("chart-5"),
            chart6: resolveColor("chart-6"),
            chart7: resolveColor("chart-7"),
            grid: resolveColor("chart-grid"),
            palette: [
                resolveColor("chart-1"),
                resolveColor("chart-2"),
                resolveColor("chart-4"),
                resolveColor("chart-3"),
                resolveColor("chart-5"),
                resolveColor("chart-6"),
                resolveColor("chart-7"),
            ],
        }),
        [],
    );
}
