import React from "react";
import { render } from "@testing-library/react";
import { App } from "./App";

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
