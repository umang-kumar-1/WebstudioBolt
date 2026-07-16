import { useEffect, useState } from "react";

declare global {
    interface Window {
        google: any;
        _spPageContextInfo?: any;
    }
}

const useLocalGoogleCharts = () => {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // Already fully initialised
        if (window.google && window.google.visualization && window.google.visualization.GeoChart) {
            setLoaded(true);
            return;
        }

        // Script already injected — just poll until ready
        const existing = document.querySelector(`script[data-gc-local]`);
        if (existing) {
            const tid = setInterval(() => {
                if (window.google && window.google.visualization && window.google.visualization.GeoChart) {
                    setLoaded(true);
                    clearInterval(tid);
                }
            }, 100);
            return () => clearInterval(tid);
        }

        const ctx = window._spPageContextInfo;
        const loaderCandidates = [
            "https://www.gstatic.com/charts/loader.js",
            ctx?.webAbsoluteUrl ? `${ctx.webAbsoluteUrl}/SiteAssets/google/loader.js` : "",
            "https://grueneweltweit.sharepoint.com/sites/GrueneWeltweit/Washington/webstudio/SiteAssets/showchart.js"
        ].filter(Boolean);

        const tryLoad = (index: number) => {
            if (index >= loaderCandidates.length) {
                console.error("useLocalGoogleCharts: All loader candidates failed.");
                return;
            }

            const loaderUrl = loaderCandidates[index];
            console.log("useLocalGoogleCharts: Injecting loader from: " + loaderUrl);

            const script = document.createElement("script");
            script.setAttribute("data-gc-local", "true");
            script.src = loaderUrl;
            script.async = true;

            script.onload = () => {
                if (!window.google || !window.google.charts) {
                    console.error("Loader loaded but window.google.charts missing:", loaderUrl);
                    tryLoad(index + 1);
                    return;
                }

                window.google.charts.load("current", { packages: ["geochart"] });
                window.google.charts.setOnLoadCallback(() => setLoaded(true));
            };

            script.onerror = () => {
                console.error("useLocalGoogleCharts: Failed loading:", loaderUrl);
                tryLoad(index + 1);
            };

            document.body.appendChild(script);
        };

        tryLoad(0);
    }, []);

    return loaded;
};

export default useLocalGoogleCharts;