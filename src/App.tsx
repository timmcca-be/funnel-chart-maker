import React, { useEffect, useRef, useState } from "react";
import { Context as SvgContext } from "svgcanvas";

import { NumberInput } from "./NumberInput";
import { FunnelDataInput } from "./FunnelDataInput";
import { drawChart } from "./drawChart";
import styles from "./App.module.css";

import type { DataPoint } from "./FunnelDataInput";

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
export const exportedForTesting = {
    annotateData,
};

function makeSvgContext(options: {
    width: number;
    height: number;
}): CanvasRenderingContext2D & {
    getSerializedSvg: (fixNamedEntities?: boolean) => string;
} {
    return new SvgContext(options);
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
    const canvasRef = useRef<HTMLCanvasElement>(null);
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

    useEffect(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (ctx == null) {
            return;
        }
        drawChart(ctx, annotateData(funnelData), {
            width,
            height,
            gradientBase,
        });
        return () => ctx.clearRect(0, 0, width, height);
    }, [funnelData, width, height, gradientBase]);

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
                            const ctx = makeSvgContext({ width, height });
                            drawChart(ctx, annotateData(funnelData), {
                                width,
                                height,
                                gradientBase,
                            });
                            downloadSvg(ctx.getSerializedSvg());
                        }}
                        className={styles.downloadButton}
                    >
                        download as svg
                    </button>
                    <canvas ref={canvasRef} width={width} height={height} />
                </>
            ) : (
                <p>{funnelDataError}</p>
            )}
        </div>
    );
}
