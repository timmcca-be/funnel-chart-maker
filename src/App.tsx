import React, { useMemo, useRef, useState } from "react";
import "chart.js/auto";
import { Chart as ChartJS } from "chart.js";
import { Chart } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import Gradient from "linear-gradient";
import styles from "./App.module.css";

import type { ChartData, ChartOptions } from "chart.js";

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

type DataPoint =
    | {
          type: "blank";
      }
    | {
          type: "step";
          name: string;
          count: number;
      };

function parseData(rawJson: string): { error: string } | { data: DataPoint[] } {
    try {
        const result = JSON.parse(rawJson);
        if (!Array.isArray(result)) {
            return { error: "not an array" };
        }
        for (let i = 0; i < result.length; i++) {
            const dataPoint = result[i];
            if (dataPoint == null) {
                return { error: `null at index ${i}` };
            }
            if (typeof dataPoint !== "object") {
                return { error: `not an object at index ${i}` };
            }
            switch (dataPoint.type) {
                case "blank":
                    break;
                case "step":
                    if (typeof dataPoint.name !== "string") {
                        return {
                            error: `step name not a string at index ${i}`,
                        };
                    }
                    if (typeof dataPoint.count !== "number") {
                        return {
                            error: `step count not a number at index ${i}`,
                        };
                    }
                    break;
                case null:
                case undefined:
                    return {
                        error: `missing step type at index ${i}`,
                    };
                default:
                    return {
                        error: `invalid step type at index ${i}: ${dataPoint.type}`,
                    };
            }
        }

        return { data: result };
    } catch (e) {
        return { error: "invalid JSON" };
    }
}

type AnnotatedDataPoint =
    | {
          type: "blank";
      }
    | {
          type: "step";
          name: string;
          count: number;
          padding: number;
          absoluteProportion: number;
          relativeProportion: number | null;
      };

function annotateData(data: DataPoint[]): AnnotatedDataPoint[] {
    let firstStepCount: number | null = null;
    let preceedingStepCount: number | null = null;
    return data.map((dataPoint) => {
        if (dataPoint.type === "blank") {
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

function buildChartData(
    data: AnnotatedDataPoint[],
    gradientBase: number
): ChartData {
    return {
        labels: data.map((dataPoint) =>
            dataPoint.type === "blank" ? "" : dataPoint.name
        ),
        datasets: [
            {
                label: "padding",
                data: data.map((dataPoint) =>
                    dataPoint.type === "blank" ? 0 : dataPoint.padding
                ),
                backgroundColor: "rgba(0, 0, 0, 0)",
                datalabels: {
                    display: false,
                },
            },
            {
                label: "counts",
                data: data.map((dataPoint) =>
                    dataPoint.type === "blank" ? 0 : dataPoint.count
                ),
                backgroundColor: data.map((dataPoint) =>
                    dataPoint.type === "blank"
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
                                data[dataIndex].type === "blank"
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
                                return dataPoint.type === "blank"
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
                                return dataPoint.type === "blank"
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

function buildChartOptions(data: AnnotatedDataPoint[]): ChartOptions {
    return {
        indexAxis: "y",
        scales: {
            x: {
                display: false,
                stacked: true,
                max: data
                    .map((dataPoint) =>
                        dataPoint.type === "blank" ? 0 : dataPoint.count
                    )
                    .find((count) => count > 0),
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
        animation: false,
        maintainAspectRatio: false,
        events: [],
    };
}

export function App() {
    const [rawJson, setRawJson] = useState("");
    const [width, setWidth] = useState("1200");
    const [height, setHeight] = useState("600");
    const validatedGradientBaseRef = useRef(0);
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
        return { data: annotateData(result.data) };
    }, [rawJson]);

    return (
        <div className={styles.app}>
            <p>
                check out{" "}
                <a href="https://github.com/timmcca-be/funnel-chart-maker">
                    the readme
                </a>{" "}
                if you{"'"}re confused
            </p>
            <label>
                json chart data:
                <textarea
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                />
            </label>
            <label>
                width:
                <input
                    type="number"
                    value={width}
                    min={1}
                    onChange={(e) => setWidth(e.target.value)}
                />
            </label>
            <label>
                height:
                <input
                    type="number"
                    value={height}
                    min={1}
                    onChange={(e) => setHeight(e.target.value)}
                />
            </label>
            <label>
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
                            validatedGradientBaseRef.current = newValue;
                        }
                    }}
                />
            </label>
            {"error" in parseResult ? (
                <p>{parseResult.error}</p>
            ) : (
                <div style={{ width: `${width}px`, height: `${height}px` }}>
                    <Chart
                        type="bar"
                        data={buildChartData(
                            parseResult.data,
                            validatedGradientBaseRef.current
                        )}
                        options={buildChartOptions(parseResult.data)}
                    />
                </div>
            )}
        </div>
    );
}
