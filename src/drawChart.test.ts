import { exportedForTesting } from "./drawChart";

import type { DataPoint } from "./FunnelDataInput";

const { annotateData } = exportedForTesting;

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
                absoluteProportion: 1,
                relativeProportion: null,
            },
            {
                name: "did another thing",
                count: 80,
                absoluteProportion: 0.8,
                relativeProportion: 0.8,
            },
            "blank",
            {
                name: "did something good",
                count: 60,
                absoluteProportion: 0.6,
                relativeProportion: 0.75,
            },
        ]);
    });
});
