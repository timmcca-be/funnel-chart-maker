import React from "react";
import { render } from "@testing-library/react";
import { App, exportedForTesting } from "./App";

import type { DataPoint } from "./App";

class ResizeObserver {
    observe() {
        // empty
    }
    unobserve() {
        // emtpy
    }
    disconnect() {
        // empty
    }
}

describe("App", () => {
    it("renders without errors", () => {
        window.ResizeObserver = ResizeObserver;
        render(<App />);
    });
});

const { parseData, validateData, annotateData, getTopOfFunnelCount } =
    exportedForTesting;

describe("parseData", () => {
    it("parses the data correctly", () => {
        // arrange
        const input = `[
            {"name": "did a thing", "count": 100},
            {"name": "did another thing", "count": 80},
            "blank",
            {"name": "did something good", "count": 60}
        ]`;

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            data: [
                { name: "did a thing", count: 100 },
                { name: "did another thing", count: 80 },
                "blank",
                { name: "did something good", count: 60 },
            ],
        });
    });

    it("returns an error if the data is not valid JSON", () => {
        // arrange
        const input = "not valid json";

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: "invalid JSON",
        });
    });

    it("returns an error if the data is not an array", () => {
        // arrange
        const input = "{}";

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: "not an array",
        });
    });

    it("returns an error if the array contains a null element", () => {
        // arrange
        const input = "[null]";

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: "null at index 0",
        });
    });

    it("returns an error if the array contains an element that is not 'blank' or an object", () => {
        // arrange
        const input = "[1]";

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: 'not "blank" or an object at index 0',
        });
    });

    it("returns an error if the array contains an object that does not have a 'name' property", () => {
        // arrange
        const input = '[{"count": 100}]';

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: "step name missing at index 0",
        });
    });

    it("returns an error if the array contains an object whose step name is not a string", () => {
        // arrange
        const input = '[{"name": 1, "count": 100}]';

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: "step name not a string at index 0",
        });
    });

    it("returns an error if the array contains an object that does not have a 'count' property", () => {
        // arrange
        const input = '[{"name": "did a thing"}]';

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: "step count missing at index 0",
        });
    });

    it("returns an error if the array contains an object whose step count is not a number", () => {
        // arrange
        const input = '[{"name": "did a thing", "count": "100"}]';

        // act
        const result = parseData(input);

        // assert
        expect(result).toEqual({
            error: "step count not a number at index 0",
        });
    });
});

describe("validateData", () => {
    it("returns null for valid data", () => {
        // arrange
        const input: DataPoint[] = [
            { name: "did a thing", count: 100 },
            { name: "did another thing", count: 80 },
            "blank",
            { name: "did something good", count: 60 },
        ];

        // act
        const result = validateData(input);

        // assert
        expect(result).toBeNull();
    });

    it("returns an error if a later step has a higher count than an earlier step", () => {
        // arrange
        const input: DataPoint[] = [
            { name: "did a thing", count: 100 },
            { name: "did another thing", count: 80 },
            "blank",
            { name: "did something good", count: 90 },
        ];

        // act
        const result = validateData(input);

        // assert
        expect(result).toEqual({
            error: "step count at index 3 is greater than the previous step count",
        });
    });
});

describe("annotateData", () => {
    it("works", () => {
        // arrange
        const input: DataPoint[] = [
            { name: "did a thing", count: 100 },
            { name: "did another thing", count: 80 },
            "blank",
            { name: "did something good", count: 60 },
        ];

        // act
        const result = annotateData(input);

        // assert
        expect(result).toEqual([
            {
                name: "did a thing",
                count: 100,
                padding: 0,
                absoluteProportion: 1,
                relativeProportion: null,
            },
            {
                name: "did another thing",
                count: 80,
                padding: 10,
                absoluteProportion: 0.8,
                relativeProportion: 0.8,
            },
            "blank",
            {
                name: "did something good",
                count: 60,
                padding: 20,
                absoluteProportion: 0.6,
                relativeProportion: 0.75,
            },
        ]);
    });
});

describe("getTopOfFunnelCount", () => {
    it("works", () => {
        // arrange
        const input: DataPoint[] = [
            "blank",
            { name: "did a thing", count: 100 },
            { name: "did another thing", count: 80 },
            "blank",
            { name: "did something good", count: 60 },
        ];

        // act
        const result = getTopOfFunnelCount(input);

        // assert
        expect(result).toEqual(100);
    });
});
