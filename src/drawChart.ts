import Gradient from "linear-gradient";

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

export const exportedForTesting = { annotateData };

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

type Rect = {
    topLeftCorner: {
        x: number;
        y: number;
    };
    width: number;
    height: number;
};

function fillRect(ctx: CanvasRenderingContext2D, rect: Rect, color: string) {
    ctx.fillStyle = color;
    ctx.fillRect(
        rect.topLeftCorner.x,
        rect.topLeftCorner.y,
        rect.width,
        rect.height
    );
}

type TextParameters = {
    fontSize: number;
    lineHeight: number;
};

function setFontSize(ctx: CanvasRenderingContext2D, fontSize: number) {
    ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
}

function measureTextWidth(
    ctx: CanvasRenderingContext2D,
    text: string | string[],
    fontSize: number
) {
    const lines = Array.isArray(text) ? text : [text];
    setFontSize(ctx, fontSize);
    return Math.max(...lines.map((line) => ctx.measureText(line).width));
}

function measureHeightOfLines(
    numberOfLines: number,
    textParameters: TextParameters
) {
    return (
        numberOfLines * textParameters.fontSize +
        (numberOfLines - 1) *
            (textParameters.lineHeight - textParameters.fontSize)
    );
}

function writeText(
    ctx: CanvasRenderingContext2D,
    position: {
        x: number;
        y: number;
    },
    text: string | string[],
    textParameters: TextParameters
) {
    const lines = Array.isArray(text) ? text : [text];
    ctx.textBaseline = "top";
    setFontSize(ctx, textParameters.fontSize);
    const totalHeight = measureHeightOfLines(lines.length, textParameters);
    const topOfFirstLine = position.y - totalHeight / 2;
    lines.forEach((line, index) => {
        const y = topOfFirstLine + index * textParameters.lineHeight;
        ctx.fillText(line, position.x, y);
    });
}

function writeCenterText(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    text: string | string[],
    textParameters: TextParameters
) {
    const position = {
        x: rect.topLeftCorner.x + rect.width / 2,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    writeText(ctx, position, text, textParameters);
}

const textPadding = 4;
const betweenTextPadding = 24;

function writeInnerLeftText(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    text: string | string[],
    textParameters: TextParameters
) {
    const position = {
        x: rect.topLeftCorner.x + textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    writeText(ctx, position, text, textParameters);
}

function writeOuterLeftText(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    text: string | string[],
    textParameters: TextParameters
) {
    const position = {
        x: rect.topLeftCorner.x - textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    ctx.fillStyle = "black";
    ctx.textAlign = "right";
    writeText(ctx, position, text, textParameters);
}

function writeInnerRightText(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    text: string | string[],
    textParameters: TextParameters
) {
    const position = {
        x: rect.topLeftCorner.x + rect.width - textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    ctx.fillStyle = "white";
    ctx.textAlign = "right";
    writeText(ctx, position, text, textParameters);
}

function writeOuterRightText(
    ctx: CanvasRenderingContext2D,
    rect: Rect,
    text: string | string[],
    textParameters: TextParameters
) {
    const position = {
        x: rect.topLeftCorner.x + rect.width + textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    writeText(ctx, position, text, textParameters);
}

function wrapTextToWidth(
    ctx: CanvasRenderingContext2D,
    text: string,
    fontSize: number,
    width: number
): {
    hasHorizontalOverflow: boolean;
    lines: string[];
} {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    let hasHorizontalOverflow = false;
    words.forEach((word) => {
        const currentLineWithWord =
            currentLine + (currentLine === "" ? "" : " ") + word;
        const currentLineWidth = measureTextWidth(
            ctx,
            currentLineWithWord,
            fontSize
        );
        if (currentLineWidth > width) {
            lines.push(currentLine);
            currentLine = word;
            if (measureTextWidth(ctx, word, fontSize) > width) {
                // this word alone is longer than the width
                hasHorizontalOverflow = true;
            }
        } else {
            currentLine = currentLineWithWord;
        }
    });
    lines.push(currentLine);
    return { lines, hasHorizontalOverflow };
}

export function drawChart(
    ctx: CanvasRenderingContext2D,
    data: DataPoint[],
    {
        width,
        height,
        gradientBase,
    }: {
        width: number;
        height: number;
        gradientBase: number;
    }
) {
    const verticalBarSpacing = height / (data.length - 1 / 4);
    const barHeight = verticalBarSpacing * (3 / 4);
    annotateData(data).forEach((dataPoint, index) => {
        if (dataPoint === "blank") {
            return;
        }

        const barWidth = width * dataPoint.absoluteProportion;
        const padding = (width - barWidth) / 2;
        const rect = {
            topLeftCorner: {
                x: padding,
                y: index * verticalBarSpacing,
            },
            width: barWidth,
            height: barHeight,
        };
        const color = getColor(dataPoint.absoluteProportion, gradientBase);
        fillRect(ctx, rect, color);

        const usersLabel = `${dataPoint.count} users`;
        const percentageLabels = [
            `${Math.round(dataPoint.absoluteProportion * 100)}% absolute`,
            ...(dataPoint.relativeProportion === null
                ? []
                : [
                      `${Math.round(
                          dataPoint.relativeProportion * 100
                      )}% relative`,
                  ]),
        ];

        const outsideBarSpace = (width - barWidth) / 2 - 2 * textPadding;
        const stepNameWrappedOutside = wrapTextToWidth(
            ctx,
            dataPoint.name,
            14,
            outsideBarSpace
        );

        if (ctx.measureText(usersLabel).width + 2 * textPadding > barWidth) {
            writeOuterLeftText(ctx, rect, stepNameWrappedOutside.lines, {
                fontSize: 14,
                lineHeight: 18,
            });
            writeOuterRightText(ctx, rect, [usersLabel, ...percentageLabels], {
                fontSize: 14,
                lineHeight: 18,
            });
            return;
        }

        writeCenterText(ctx, rect, usersLabel, {
            fontSize: 16,
            lineHeight: 20,
        });

        const insideBarSpace =
            (barWidth - measureTextWidth(ctx, usersLabel, 16)) / 2 -
            textPadding -
            betweenTextPadding;
        const stepNameWrappedInside = wrapTextToWidth(
            ctx,
            dataPoint.name,
            14,
            insideBarSpace
        );
        if (
            (stepNameWrappedInside.hasHorizontalOverflow &&
                !stepNameWrappedOutside.hasHorizontalOverflow) ||
            (stepNameWrappedInside.lines.length > 2 &&
                stepNameWrappedOutside.lines.length <
                    stepNameWrappedInside.lines.length)
        ) {
            writeOuterLeftText(ctx, rect, stepNameWrappedOutside.lines, {
                fontSize: 14,
                lineHeight: 18,
            });
        } else {
            writeInnerLeftText(ctx, rect, stepNameWrappedInside.lines, {
                fontSize: 14,
                lineHeight: 18,
            });
        }

        const percentageLabelsWidth = measureTextWidth(
            ctx,
            percentageLabels,
            14
        );
        if (
            percentageLabelsWidth < insideBarSpace ||
            insideBarSpace >= outsideBarSpace
        ) {
            writeInnerRightText(ctx, rect, percentageLabels, {
                fontSize: 14,
                lineHeight: 18,
            });
        } else {
            writeOuterRightText(ctx, rect, percentageLabels, {
                fontSize: 14,
                lineHeight: 18,
            });
        }
    });
}
