import React, { useState } from "react";
import styles from "./NumberInput.module.css";

export function NumberInput({
    value,
    onChange,
    label,
    min,
    max,
    step,
}: {
    value: number;
    onChange: (value: number) => void;
    label: string;
    min?: number;
    max?: number;
    step?: number;
}) {
    const [inputValue, setInputValue] = useState(value.toString());

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
        const newValue = parseFloat(event.target.value);
        if (
            !isNaN(newValue) &&
            (min == null || newValue >= min) &&
            (max == null || newValue <= max)
        ) {
            onChange(newValue);
        }
    };

    return (
        <label className={styles.inputLabel}>
            {label}:
            <input
                type="number"
                value={inputValue}
                onChange={handleChange}
                min={min}
                max={max}
                step={step}
            />
        </label>
    );
}
