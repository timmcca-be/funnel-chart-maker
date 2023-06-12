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

function measureHeightOfLines(numberOfLines: number, fontSize: number) {
    return numberOfLines * fontSize + (numberOfLines - 1) * textPadding;
}

type Point = {
    // distance from left edge of canvas to point
    x: number;
    // distance from top edge of canvas to point
    y: number;
};

type Rect = {
    topLeftCorner: Point;
    width: number;
    height: number;
};

type TextParameters = {
    fontSize: number;
    color: string;
    textAlign: CanvasTextAlign;
};

// CanvasRenderingContext2D is very stateful, so we wrap it in a class to
// isolate the logic that has to touch it directly.
class ChartContext {
    _ctx: CanvasRenderingContext2D;

    constructor(ctx: CanvasRenderingContext2D) {
        this._ctx = ctx;
    }

    _setFontSize(fontSize: number) {
        this._ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
    }

    measureTextWidth(text: string | string[], fontSize: number) {
        const lines = Array.isArray(text) ? text : [text];
        this._setFontSize(fontSize);
        return Math.max(
            ...lines.map((line) => this._ctx.measureText(line).width)
        );
    }

    writeText(
        position: Point,
        text: string | string[],
        { fontSize, color, textAlign }: TextParameters
    ) {
        const lines = Array.isArray(text) ? text : [text];
        this._ctx.textBaseline = "top";
        this._ctx.fillStyle = color;
        this._ctx.textAlign = textAlign;
        this._setFontSize(fontSize);
        const lineHeight = fontSize + textPadding;
        const totalHeight = measureHeightOfLines(lines.length, fontSize);
        const topOfFirstLine = position.y - totalHeight / 2;
        lines.forEach((line, index) => {
            const y = topOfFirstLine + index * lineHeight;
            this._ctx.fillText(line, position.x, y);
        });
    }

    fillRect(rect: Rect, color: string) {
        this._ctx.fillStyle = color;
        this._ctx.fillRect(
            rect.topLeftCorner.x,
            rect.topLeftCorner.y,
            rect.width,
            rect.height
        );
    }
}

function writeCenterText(
    chartCtx: ChartContext,
    rect: Rect,
    text: string | string[],
    fontSize: number
) {
    const position = {
        x: rect.topLeftCorner.x + rect.width / 2,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    chartCtx.writeText(position, text, {
        fontSize,
        color: "white",
        textAlign: "center",
    });
}

const textPadding = 4;
const betweenTextPadding = 24;

function writeInnerLeftText(
    chartCtx: ChartContext,
    rect: Rect,
    text: string | string[],
    fontSize: number
) {
    const position = {
        x: rect.topLeftCorner.x + textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    chartCtx.writeText(position, text, {
        fontSize,
        color: "white",
        textAlign: "left",
    });
}

function writeOuterLeftText(
    chartCtx: ChartContext,
    rect: Rect,
    text: string | string[],
    fontSize: number
) {
    const position = {
        x: rect.topLeftCorner.x - textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    chartCtx.writeText(position, text, {
        fontSize,
        color: "black",
        textAlign: "right",
    });
}

function writeInnerRightText(
    chartCtx: ChartContext,
    rect: Rect,
    text: string | string[],
    fontSize: number
) {
    const position = {
        x: rect.topLeftCorner.x + rect.width - textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    chartCtx.writeText(position, text, {
        fontSize,
        color: "white",
        textAlign: "right",
    });
}

function writeOuterRightText(
    chartCtx: ChartContext,
    rect: Rect,
    text: string | string[],
    fontSize: number
) {
    const position = {
        x: rect.topLeftCorner.x + rect.width + textPadding,
        y: rect.topLeftCorner.y + rect.height / 2,
    };
    chartCtx.writeText(position, text, {
        fontSize,
        color: "black",
        textAlign: "left",
    });
}

function wrapTextToWidth(
    chartCtx: ChartContext,
    text: string,
    fontSize: number,
    width: number
): {
    hasHorizontalOverflow: boolean;
    lines: string[];
} {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine: string | null = null;
    let hasHorizontalOverflow = false;
    words.forEach((word) => {
        const currentLineWithWord =
            currentLine === null ? word : `${currentLine} ${word}`;
        const currentLineWidth = chartCtx.measureTextWidth(
            currentLineWithWord,
            fontSize
        );
        if (currentLineWidth > width) {
            if (currentLine === null) {
                // this word alone has pushed us over the width
                hasHorizontalOverflow = true;
                lines.push(word);
                currentLine = null;
            } else {
                hasHorizontalOverflow ||=
                    chartCtx.measureTextWidth(word, fontSize) > width;
                lines.push(currentLine);
                currentLine = word;
            }
        } else {
            currentLine = currentLineWithWord;
        }
    });
    if (currentLine !== null) {
        lines.push(currentLine);
    }
    return { lines, hasHorizontalOverflow };
}

type Spacing = {
    inside: number;
    outside: number;
};

function writeStepName(
    chartCtx: ChartContext,
    rect: Rect,
    text: string,
    spacing: Spacing
) {
    const fontSize = 14;

    const wrappedInside = wrapTextToWidth(
        chartCtx,
        text,
        fontSize,
        spacing.inside
    );
    const wrappedOutside = wrapTextToWidth(
        chartCtx,
        text,
        fontSize,
        spacing.outside
    );

    if (
        (wrappedInside.hasHorizontalOverflow &&
            !wrappedOutside.hasHorizontalOverflow) ||
        (wrappedInside.lines.length > 2 &&
            wrappedOutside.lines.length < wrappedInside.lines.length)
    ) {
        writeOuterLeftText(chartCtx, rect, wrappedOutside.lines, fontSize);
    } else {
        writeInnerLeftText(chartCtx, rect, wrappedInside.lines, fontSize);
    }
}

function writeStats(
    chartCtx: ChartContext,
    rect: Rect,
    text: string[],
    spacing: Spacing
) {
    const fontSize = 14;

    const joinedText = text.join(" / ");

    const multilineWidth = chartCtx.measureTextWidth(text, fontSize);
    const multilineHeight = measureHeightOfLines(text.length, fontSize);
    const singleLineWidth = chartCtx.measureTextWidth(joinedText, fontSize);

    // prefer multiline; i.e. only use single line if multiline is too tall
    // and single line is not too wide
    const isSingleLineMode =
        multilineHeight + 2 * textPadding > rect.height &&
        (singleLineWidth <= spacing.inside ||
            singleLineWidth <= spacing.outside);

    const textToWrite = isSingleLineMode ? joinedText : text;
    const textWidth = isSingleLineMode ? singleLineWidth : multilineWidth;

    if (textWidth < spacing.inside || spacing.inside >= spacing.outside) {
        writeInnerRightText(chartCtx, rect, textToWrite, fontSize);
    } else {
        writeOuterRightText(chartCtx, rect, textToWrite, fontSize);
    }
}

function writeUserCount(chartCtx: ChartContext, rect: Rect, text: string) {
    writeCenterText(chartCtx, rect, text, 16);
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
    const chartCtx = new ChartContext(ctx);
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
        chartCtx.fillRect(rect, color);

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

        const usersLabelWidth = chartCtx.measureTextWidth(usersLabel, 16);

        if (usersLabelWidth + 2 * textPadding > barWidth) {
            // we can't fit the label for the number of users inside the bar,
            // so we add it to the "stats" section instead
            const spacing = {
                inside: (barWidth - betweenTextPadding) / 2 - textPadding,
                outside: outsideBarSpace,
            };
            writeStepName(chartCtx, rect, dataPoint.name, spacing);
            writeStats(
                chartCtx,
                rect,
                [usersLabel, ...percentageLabels],
                spacing
            );
            return;
        }

        writeUserCount(chartCtx, rect, usersLabel);

        const spacing = {
            inside:
                (barWidth - usersLabelWidth) / 2 -
                textPadding -
                betweenTextPadding,
            outside: outsideBarSpace,
        };

        writeStepName(chartCtx, rect, dataPoint.name, spacing);
        writeStats(chartCtx, rect, percentageLabels, spacing);
    });
}
