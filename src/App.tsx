import React, { useMemo, useState } from "react";
import "chart.js/auto";
import { Chart as ChartJS } from "chart.js";
import { Chart } from "react-chartjs-2";
import { Context as SvgContext } from "svgcanvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import Gradient from "linear-gradient";

import { NumberInput } from "./NumberInput";
import { FunnelDataInput } from "./FunnelDataInput";
import styles from "./App.module.css";

import type { ChartData, ChartOptions } from "chart.js";
import type { DataPoint } from "./FunnelDataInput";

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

type AnnotatedDataPoint =
    | "blank"
    | {
          name: string;
          count: number;
          absoluteProportion: number;
          relativeProportion: number | null;
      };

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
    annotateData,
    getTopOfFunnelCount,
};

type BarDescriptor = {
    count: number;
    padding: number;
    gradientValue: number;
    outerLeftLabel: string;
    innerLeftLabel: string;
    centerLabel: string;
    innerRightLabel: string;
    outerRightLabel: string;
};

const blankBarDescriptor: BarDescriptor = {
    count: 0,
    padding: 0,
    gradientValue: 0,
    outerLeftLabel: "",
    innerLeftLabel: "",
    centerLabel: "",
    innerRightLabel: "",
    outerRightLabel: "",
};

const fontFamily = "Helvetica, Arial, sans-serif";
const centerLabelFontSize = 16;
const nonCenterLabelFontSize = 14;

function createBarDescriptor(
    point: AnnotatedDataPoint,
    topOfFunnelCount: number,
    width: number
): BarDescriptor {
    if (point === "blank") {
        return blankBarDescriptor;
    }

    const padding = (topOfFunnelCount - point.count) / 2;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx == null) {
        throw new Error("couldn't get canvas context");
    }

    const usersLabel = `${point.count} user${point.count === 1 ? "" : "s"}`;
    const absolutePercentageLabel = `${Math.round(
        point.absoluteProportion * 100
    )}% absolute`;
    const relativePercentageLabel =
        point.relativeProportion === null
            ? null
            : `${Math.round(point.relativeProportion * 100)}% relative`;
    const percentageLabel = [
        absolutePercentageLabel,
        ...(relativePercentageLabel === null ? [] : [relativePercentageLabel]),
    ].join("\n");
    const stepNameLabel = point.name;

    ctx.font = `bold ${centerLabelFontSize}px ${fontFamily}`;
    const usersLabelWidth = ctx.measureText(usersLabel).width;
    const barWidth = width * point.absoluteProportion;

    if (usersLabelWidth + 8 > barWidth) {
        return {
            count: point.count,
            padding,
            gradientValue: point.absoluteProportion,
            outerLeftLabel: stepNameLabel,
            innerLeftLabel: "",
            centerLabel: "",
            innerRightLabel: "",
            outerRightLabel: [usersLabel, percentageLabel].join("\n"),
        };
    }

    const availableHalfBarWidth = (barWidth - usersLabelWidth) / 2 - 20;
    const availablePaddingWidth = (width - barWidth) / 2 - 8;
    if (availablePaddingWidth < availableHalfBarWidth) {
        return {
            count: point.count,
            padding,
            gradientValue: point.absoluteProportion,
            outerLeftLabel: "",
            innerLeftLabel: stepNameLabel,
            centerLabel: usersLabel,
            innerRightLabel: percentageLabel,
            outerRightLabel: "",
        };
    }

    ctx.font = `bold ${nonCenterLabelFontSize}px ${fontFamily}`;
    const absolutePercentageLabelWidth = ctx.measureText(
        absolutePercentageLabel
    ).width;
    const relativePercentageLabelWidth =
        relativePercentageLabel === null
            ? 0
            : ctx.measureText(relativePercentageLabel).width;
    const percentageLabelWidth = Math.max(
        absolutePercentageLabelWidth,
        relativePercentageLabelWidth
    );

    let innerRightLabel = "";
    let outerRightLabel = "";
    if (percentageLabelWidth > availableHalfBarWidth) {
        outerRightLabel = percentageLabel;
    } else {
        innerRightLabel = percentageLabel;
    }

    let innerLeftLabel = "";
    let outerLeftLabel = "";
    const stepNameLabelWidth = ctx.measureText(stepNameLabel).width;
    if (stepNameLabelWidth > availableHalfBarWidth) {
        outerLeftLabel = stepNameLabel;
    } else {
        innerLeftLabel = stepNameLabel;
    }

    return {
        count: point.count,
        padding,
        gradientValue: point.absoluteProportion,
        outerLeftLabel,
        innerLeftLabel,
        centerLabel: usersLabel,
        innerRightLabel,
        outerRightLabel,
    };
}

function buildChartData(
    bars: BarDescriptor[],
    gradientBase: number
): ChartData {
    return {
        labels: bars.map(() => ""),
        datasets: [
            {
                label: "left padding",
                data: bars.map((bar) => bar.padding),
                backgroundColor: "rgba(0, 0, 0, 0)",
                datalabels: {
                    color: "black",
                    padding: 0,
                    font: {
                        weight: "bold",
                        size: 14,
                        family: fontFamily,
                    },
                    align: "left",
                    anchor: "end",
                    formatter: (_, { dataIndex }) =>
                        bars[dataIndex].outerLeftLabel,
                },
            },
            {
                label: "counts",
                data: bars.map((bar) => bar.count),
                backgroundColor: bars.map((bar) =>
                    getColor(bar.gradientValue, gradientBase)
                ),
                datalabels: {
                    color: "white",
                    padding: 0,
                    font: {
                        weight: "bold",
                        family: fontFamily,
                    },
                    labels: {
                        center: {
                            font: {
                                size: 16,
                            },
                            formatter: (_, { dataIndex }) =>
                                bars[dataIndex].centerLabel,
                        },
                        innerRight: {
                            align: "left",
                            anchor: "end",
                            font: {
                                size: 14,
                            },
                            formatter: (_, { dataIndex }) =>
                                bars[dataIndex].innerRightLabel,
                        },
                        innerLeft: {
                            anchor: "start",
                            align: "right",
                            font: {
                                size: 14,
                            },
                            formatter: (_, { dataIndex }) =>
                                bars[dataIndex].innerLeftLabel,
                        },
                    },
                },
            },
            {
                label: "right padding",
                data: bars.map((bar) => bar.padding),
                backgroundColor: "rgba(0, 0, 0, 0)",
                datalabels: {
                    color: "black",
                    padding: 0,
                    font: {
                        weight: "bold",
                        size: 14,
                        family: fontFamily,
                    },
                    align: "right",
                    anchor: "start",
                    formatter: (_, { dataIndex }) =>
                        bars[dataIndex].outerRightLabel,
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

const defaultFunnelData: DataPoint[] = [
    { name: "did a thing", count: 100 },
    { name: "did another thing", count: 80 },
    "blank",
    { name: "did something good", count: 60 },
];

export function App() {
    const [funnelData, setFunnelData] =
        useState<DataPoint[]>(defaultFunnelData);
    const [funnelDataError, setFunnelDataError] = useState<string | null>(null);
    const [width, setWidth] = useState(1200);
    const [height, setHeight] = useState(600);
    // 0 <= gradientBase < 1
    // this sets the "bottom" of the gradient. so if you want the gradient to
    // span 0.3 to 1, you'd set this to 0.3. set this a little below the lowest
    // absolute proportion in all of the funnels you're comparing.
    const [gradientBase, setGradientBase] = useState(0);

    const chartProps = useMemo(() => {
        const annotated = annotateData(funnelData);
        const topOfFunnelCount = getTopOfFunnelCount(funnelData);
        return {
            data: buildChartData(
                annotated.map((point) =>
                    createBarDescriptor(point, topOfFunnelCount, width)
                ),
                gradientBase
            ),
            options: buildChartOptions(topOfFunnelCount),
        };
    }, [funnelData, gradientBase, width]);

    return (
        <div className={styles.app}>
            <p>
                check out{" "}
                <a href="https://github.com/timmcca-be/funnel-chart-maker">
                    the readme
                </a>{" "}
                if you{"'"}re confused
            </p>
            <FunnelDataInput
                value={funnelData}
                onChange={setFunnelData}
                setErrorMessage={setFunnelDataError}
            />
            <NumberInput
                label="width"
                value={width}
                onChange={setWidth}
                min={1}
            />
            <NumberInput
                label="height"
                value={height}
                onChange={setHeight}
                min={1}
            />
            <NumberInput
                label="gradient base"
                value={gradientBase}
                onChange={setGradientBase}
                min={0}
                max={0.99}
                step={0.01}
            />
            {funnelDataError === null ? (
                <>
                    <button
                        onClick={() => {
                            const chartSvg = createChartSvg(
                                {
                                    width,
                                    height,
                                    gradientBase,
                                },
                                chartProps.data,
                                chartProps.options
                            );
                            downloadSvg(chartSvg);
                        }}
                        className={styles.downloadButton}
                    >
                        download as svg
                    </button>
                    <div style={{ width, height }}>
                        <Chart type="bar" {...chartProps} />
                    </div>
                </>
            ) : (
                <p>{funnelDataError}</p>
            )}
        </div>
    );
}
