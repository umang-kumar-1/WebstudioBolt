import React, { useEffect, useRef, useState } from "react";
import useLocalGoogleCharts from "./hook/useLocalGoogleCharts";

const ALL_STATES = [
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen",
];

const GermanyMap = ({ selectedState, onStateClick, uniformFill = false }: any) => {
    const loaded = useLocalGoogleCharts();
    const chartRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredState, setHoveredState] = useState<string | null>(null);

    useEffect(() => {
        if (!loaded || !containerRef.current) return;

        const data = window.google.visualization.arrayToDataTable([
            ["State", "Selected"],
            ...ALL_STATES.map((state) => {
                if (hoveredState === state) return [state, 2];
                if (uniformFill) return [state, 1];
                return [state, state === selectedState ? 1 : 0];
            }),
        ]);

        const options = {
            region: "DE",
            resolution: "provinces",
            colorAxis: {
                minValue: 0,
                maxValue: 2,
                colors: uniformFill ? ["#1f7f1f", "#1f7f1f", "#0a46a6"] : ["#c8dfc8", "#005437", "#0a46a6"],
            },
            backgroundColor: "#ffffff",
            datalessRegionColor: "#e8e8e8",
            tooltip: { trigger: "focus" },
            legend: 'none'
        };

        if (!chartRef.current) {
            chartRef.current = new window.google.visualization.GeoChart(containerRef.current);

            window.google.visualization.events.addListener(chartRef.current, "select", () => {
                const selection = chartRef.current.getSelection();
                if (selection.length > 0 && selection[0].row != null) {
                    const state = ALL_STATES[selection[0].row];
                    onStateClick(state);
                }
            });

            window.google.visualization.events.addListener(chartRef.current, "onmouseover", (event: any) => {
                if (event?.row != null) {
                    setHoveredState(ALL_STATES[event.row]);
                }
            });

            window.google.visualization.events.addListener(chartRef.current, "onmouseout", () => {
                setHoveredState(null);
            });
        }

        chartRef.current.draw(data, options);
    }, [loaded, selectedState, uniformFill, hoveredState]);

    if (!loaded) {
        return (
            <div style={{ width: "100%", height: "560px", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
                Loading map...
            </div>
        );
    }

    return <div ref={containerRef} style={{ width: "100%", height: "560px" }} />;
};

export default GermanyMap;