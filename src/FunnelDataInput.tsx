import React, { useState } from "react";

import styles from "./FunnelDataInput.module.css";

export type DataPoint =
    | "blank"
    | {
          name: string;
          count: number;
      };

export type FunnelParseResult = { data: DataPoint[] } | { error: string };

function parseData(rawJson: string): FunnelParseResult {
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

export const exportedForTesting = {
    parseData,
    validateData,
};

export function FunnelDataInput({
    value,
    onChange,
    setErrorMessage,
}: {
    value: DataPoint[];
    onChange: (result: DataPoint[]) => void;
    setErrorMessage: (error: string | null) => void;
}) {
    const [rawJson, setRawJson] = useState(
        `[\n    ${value
            .map((dataPoint) =>
                dataPoint === "blank"
                    ? '"blank"'
                    : `{"name": "${dataPoint.name}", "count": ${dataPoint.count}}`
            )
            .join(",\n    ")}\n]`
    );

    return (
        <label className={styles.jsonInputLabel}>
            json chart data:
            <textarea
                className={styles.jsonInput}
                value={rawJson}
                onChange={(e) => {
                    setRawJson(e.target.value);

                    const result = parseData(e.target.value);
                    if ("error" in result) {
                        setErrorMessage(result.error);
                        return;
                    }
                    const { data } = result;
                    const validationError = validateData(data);
                    if (validationError != null) {
                        setErrorMessage(validationError.error);
                        return;
                    }
                    setErrorMessage(null);
                    onChange(data);
                }}
            />
        </label>
    );
}
