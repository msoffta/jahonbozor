import { useSyncExternalStore } from "react";

function resolveColor(name: string): string {
    if (typeof document === "undefined") return "";
    return getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
}

/** Fallbacks matching the @theme definitions in globals.css */
const FALLBACK = {
    chart1: "hsl(217 91% 60%)",
    chart2: "hsl(160 84% 39%)",
    chart3: "hsl(0 84% 60%)",
    chart4: "hsl(38 92% 50%)",
    chart5: "hsl(258 90% 66%)",
    chart6: "hsl(330 81% 60%)",
    chart7: "hsl(189 94% 43%)",
    grid: "hsl(220 13% 91%)",
};

function buildColors() {
    const c1 = resolveColor("chart-1") || FALLBACK.chart1;
    const c2 = resolveColor("chart-2") || FALLBACK.chart2;
    const c3 = resolveColor("chart-3") || FALLBACK.chart3;
    const c4 = resolveColor("chart-4") || FALLBACK.chart4;
    const c5 = resolveColor("chart-5") || FALLBACK.chart5;
    const c6 = resolveColor("chart-6") || FALLBACK.chart6;
    const c7 = resolveColor("chart-7") || FALLBACK.chart7;
    const grid = resolveColor("chart-grid") || FALLBACK.grid;

    return {
        chart1: c1,
        chart2: c2,
        chart3: c3,
        chart4: c4,
        chart5: c5,
        chart6: c6,
        chart7: c7,
        grid,
        palette: [c1, c2, c4, c3, c5, c6, c7],
    };
}

// Snapshot is stable — CSS variables don't change at runtime
const snapshot = buildColors();
// eslint-disable-next-line @typescript-eslint/no-empty-function -- useSyncExternalStore requires a subscribe that returns an unsubscribe noop
const subscribe = () => () => {};

export function useChartColors() {
    return useSyncExternalStore(subscribe, () => snapshot);
}
