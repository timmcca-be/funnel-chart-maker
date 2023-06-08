import React, { useMemo, useState } from "react";
import "chart.js/auto";
import { Chart as ChartJS } from "chart.js";
import { Chart } from "react-chartjs-2";
import { Context as SvgContext } from "svgcanvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import Gradient from "linear-gradient";
import styles from "./App.module.css";

import type { ChartData, ChartOptions } from "chart.js";

function makeSvgContext(options: {
    width: number;
    height: number;
}): CanvasRenderingContext2D & {
    getSerializedSvg: (fixNamedEntities?: boolean) => string;
} {
    const ctx = new SvgContext(options);

    // THANK YOU https://stackoverflow.com/questions/45563420/exporting-chart-js-charts-to-svg-using-canvas2svg-js/47943363#47943363
    // these changes to ctx are a hack to make chart.js work with svgcanvas

    ctx.getContext = function (contextId: string) {
        if (contextId == "2d" || contextId == "2D") {
            return this;
        }
        return null;
    };

    ctx.style = function () {
        return this.__canvas.style;
    };

    ctx.getAttribute = function (name: string) {
        return this[name];
    };

    return ctx;
}

ChartJS.register(ChartDataLabels);

const gradient = new Gradient([
    [252, 70, 107],
    [63, 94, 251],
]);

function getColor(absoluteProportion: number, gradientBase: number): string {
    const [r, g, b] = gradient.calcArray(
        Math.max((absoluteProportion - gradientBase) / (1 - gradientBase), 0)
    );
    return `rgb(${r}, ${g}, ${b})`;
}

export type DataPoint =
    | "blank"
    | {
          name: string;
          count: number;
      };

function parseData(rawJson: string): { error: string } | { data: DataPoint[] } {
    let result: unknown;
    try {
        result = JSON.parse(rawJson);
    } catch (e) {
        return { error: "invalid JSON" };
    }

    if (!Array.isArray(result)) {
        return { error: "not an array" };
    }
    for (let i = 0; i < result.length; i++) {
        const dataPoint = result[i];
        if (dataPoint === "blank") {
            continue;
        }
        if (dataPoint == null) {
            return { error: `null at index ${i}` };
        }
        if (typeof dataPoint !== "object") {
            return { error: `not "blank" or an object at index ${i}` };
        }
        if (!("name" in dataPoint)) {
            return {
                error: `step name missing at index ${i}`,
            };
        }
        if (typeof dataPoint.name !== "string") {
            return {
                error: `step name not a string at index ${i}`,
            };
        }
        if (!("count" in dataPoint)) {
            return {
                error: `step count missing at index ${i}`,
            };
        }
        if (typeof dataPoint.count !== "number") {
            return {
                error: `step count not a number at index ${i}`,
            };
        }
    }

    return { data: result };
}

type AnnotatedDataPoint =
    | "blank"
    | {
          name: string;
          count: number;
          padding: number;
          absoluteProportion: number;
          relativeProportion: number | null;
      };

function validateData(data: DataPoint[]): { error: string } | null {
    let lastCount = null;
    for (let i = 0; i < data.length; i++) {
        const dataPoint = data[i];
        if (dataPoint === "blank") {
            continue;
        }
        if (dataPoint.count < 0) {
            return {
                error: `step count at index ${i} is negative`,
            };
        }
        if (lastCount !== null && dataPoint.count > lastCount) {
            return {
                error: `step count at index ${i} is greater than the previous step count`,
            };
        }
        lastCount = dataPoint.count;
    }

    return null;
}

function annotateData(data: DataPoint[]): AnnotatedDataPoint[] {
    let firstStepCount: number | null = null;
    let preceedingStepCount: number | null = null;
    return data.map((dataPoint) => {
        if (dataPoint === "blank") {
            return dataPoint;
        }
        if (firstStepCount === null) {
            firstStepCount = dataPoint.count;
        }
        const absoluteProportion = dataPoint.count / firstStepCount;
        const relativeProportion =
            preceedingStepCount === null
                ? null
                : dataPoint.count / preceedingStepCount;
        preceedingStepCount = dataPoint.count;
        return {
            ...dataPoint,
            padding: (firstStepCount - dataPoint.count) / 2,
            absoluteProportion,
            relativeProportion,
        };
    });
}

function getTopOfFunnelCount(data: DataPoint[]): number {
    return (
        data
            .map((dataPoint) => (dataPoint === "blank" ? 0 : dataPoint.count))
            .find((count) => count > 0) ?? 0
    );
}

export const exportedForTesting = {
    parseData,
    validateData,
    annotateData,
    getTopOfFunnelCount,
};

function createChartSvg(
    options: {
        width: number;
        height: number;
        gradientBase: number;
    },
    chartData: ChartData,
    chartOptions: ChartOptions
): string {
    const svgContext = makeSvgContext({
        width: options.width,
        height: options.height,
    });
    const chart = new ChartJS(svgContext, {
        type: "bar",
        data: chartData,
        options: {
            ...chartOptions,
            // these overrides are necessary to ensure chart.js plays nicely with svgcanvas
            responsive: false,
            animation: false,
            events: [],
        },
    });
    chart.draw();
    return svgContext.getSerializedSvg(true);
}

function downloadSvg(data: string): void {
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "funnel.svg";
    a.click();
    window.URL.revokeObjectURL(url);
}

function buildChartData(
    data: AnnotatedDataPoint[],
    gradientBase: number
): ChartData {
    return {
        labels: data.map((dataPoint) =>
            dataPoint === "blank" ? "" : dataPoint.name
        ),
        datasets: [
            {
                label: "padding",
                data: data.map((dataPoint) =>
                    dataPoint === "blank" ? 0 : dataPoint.padding
                ),
                backgroundColor: "rgba(0, 0, 0, 0)",
                datalabels: {
                    display: false,
                },
            },
            {
                label: "counts",
                data: data.map((dataPoint) =>
                    dataPoint === "blank" ? 0 : dataPoint.count
                ),
                backgroundColor: data.map((dataPoint) =>
                    dataPoint === "blank"
                        ? "white"
                        : getColor(dataPoint.absoluteProportion, gradientBase)
                ),
                datalabels: {
                    color: "white",
                    labels: {
                        count: {
                            padding: 0,
                            font: {
                                size: 16,
                                weight: "bold",
                            },
                            formatter: (value, { dataIndex }) =>
                                data[dataIndex] === "blank"
                                    ? ""
                                    : `${value} users`,
                        },
                        percentages: {
                            align: "left",
                            anchor: "end",
                            padding: 0,
                            font: {
                                size: 14,
                                weight: "bold",
                            },
                            formatter: (_, { dataIndex }) => {
                                const dataPoint = data[dataIndex];
                                return dataPoint === "blank"
                                    ? ""
                                    : `${Math.round(
                                          dataPoint.absoluteProportion * 100
                                      )}% absolute${
                                          dataPoint.relativeProportion === null
                                              ? ""
                                              : ` / ${Math.round(
                                                    dataPoint.relativeProportion *
                                                        100
                                                )}% relative`
                                      }`;
                            },
                        },
                        label: {
                            anchor: "start",
                            align: "right",
                            padding: 0,
                            font: {
                                size: 14,
                                weight: "bold",
                            },
                            formatter: (_, { dataIndex }) => {
                                const dataPoint = data[dataIndex];
                                return dataPoint === "blank"
                                    ? ""
                                    : dataPoint.name;
                            },
                        },
                    },
                },
            },
        ],
    };
}

function buildChartOptions(topOfFunnelCount: number): ChartOptions {
    return {
        indexAxis: "y",
        scales: {
            x: {
                display: false,
                stacked: true,
                max: topOfFunnelCount,
            },
            y: {
                display: false,
                stacked: true,
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                enabled: false,
            },
        },
        maintainAspectRatio: false,
        animation: false,
        events: [],
    };
}

const defaultJson = `[
    {"name": "did a thing", "count": 100},
    {"name": "did another thing", "count": 80},
    "blank",
    {"name": "did something good", "count": 60}
]`;

export function App() {
    const [rawJson, setRawJson] = useState(defaultJson);
    const [validatedWidth, setValidatedWidth] = useState(1200);
    const [width, setWidth] = useState("1200");
    const [validatedHeight, setValidatedHeight] = useState(600);
    const [height, setHeight] = useState("600");
    const [validatedGradientBase, setValidatedGradientBase] = useState(0);
    // 0 <= gradientBase < 1
    // this sets the "bottom" of the gradient. so if you want the gradient to
    // span 0.3 to 1, you'd set this to 0.3. set this a little below the lowest
    // absolute proportion in all of the funnels you're comparing.
    const [gradientBase, setGradientBase] = useState("0");
    const parseResult = useMemo(() => {
        const result = parseData(rawJson);
        if ("error" in result) {
            return result;
        }
        const validationResult = validateData(result.data);
        if (validationResult !== null) {
            return validationResult;
        }
        return { data: annotateData(result.data) };
    }, [rawJson]);

    const chartData = useMemo(() => {
        if ("error" in parseResult) {
            return null;
        }
        return buildChartData(parseResult.data, validatedGradientBase);
    }, [parseResult, validatedGradientBase]);

    const chartOptions = useMemo(() => {
        if ("error" in parseResult) {
            return null;
        }
        return buildChartOptions(getTopOfFunnelCount(parseResult.data));
    }, [parseResult]);

    return (
        <div className={styles.app}>
            <p>
                check out{" "}
                <a href="https://github.com/timmcca-be/funnel-chart-maker">
                    the readme
                </a>{" "}
                if you{"'"}re confused
            </p>
            <label className={styles.jsonInputLabel}>
                json chart data:
                <textarea
                    className={styles.jsonInput}
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                />
            </label>
            <label className={styles.inputLabel}>
                width:
                <input
                    type="number"
                    value={width}
                    min={1}
                    onChange={(e) => {
                        setWidth(e.target.value);
                        const newValue = parseInt(e.target.value);
                        if (!isNaN(newValue) && newValue >= 1) {
                            setValidatedWidth(newValue);
                        }
                    }}
                />
            </label>
            <label className={styles.inputLabel}>
                height:
                <input
                    type="number"
                    value={height}
                    min={1}
                    onChange={(e) => {
                        setHeight(e.target.value);
                        const newValue = parseInt(e.target.value);
                        if (!isNaN(newValue) && newValue >= 1) {
                            setValidatedHeight(newValue);
                        }
                    }}
                />
            </label>
            <label className={styles.inputLabel}>
                gradient base:
                <input
                    type="number"
                    value={gradientBase}
                    min={0}
                    max={0.99}
                    step={0.01}
                    onChange={(e) => {
                        setGradientBase(e.target.value);
                        const newValue = parseFloat(e.target.value);
                        if (!isNaN(newValue) && newValue >= 0 && newValue < 1) {
                            setValidatedGradientBase(newValue);
                        }
                    }}
                />
            </label>
            {"error" in parseResult && <p>{parseResult.error}</p>}
            {chartData !== null && chartOptions !== null && (
                <>
                    <button
                        onClick={() => {
                            const chartSvg = createChartSvg(
                                {
                                    width: validatedWidth,
                                    height: validatedHeight,
                                    gradientBase: validatedGradientBase,
                                },
                                chartData,
                                chartOptions
                            );
                            downloadSvg(chartSvg);
                        }}
                        className={styles.downloadButton}
                    >
                        download as svg
                    </button>
                    <div
                        style={{
                            width: validatedWidth,
                            height: validatedHeight,
                        }}
                    >
                        <Chart
                            type="bar"
                            data={chartData}
                            options={chartOptions}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
