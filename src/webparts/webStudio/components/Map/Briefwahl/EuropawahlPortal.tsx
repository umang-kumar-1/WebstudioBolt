import React, { useMemo, useState } from 'react';
import GermanyMap from './GermanyMap';

const EU_STATES = [
    'Baden-Württemberg',
    'Bayern',
    'Berlin',
    'Brandenburg',
    'Bremen',
    'Hamburg',
    'Hessen',
    'Mecklenburg-Vorpommern',
    'Niedersachsen',
    'Nordrhein-Westfalen',
    'Rheinland-Pfalz',
    'Saarland',
    'Sachsen',
    'Sachsen-Anhalt',
    'Schleswig-Holstein',
    'Thüringen',
    'Belgium'
];

const EuropawahlPortal = () => {
    const [selectedState, setSelectedState] = useState('Baden-Württemberg');
    const regionBadge = useMemo(() => selectedState === 'Belgium' ? 'Belgium' : 'Washington D.C.', [selectedState]);

    return (
        <section className="w-full py-3" style={{ backgroundColor: '#efefef' }}>
            <div className="mx-auto w-full max-w-[1280px] px-4">
            <a
                href="https://grueneweltweit.sharepoint.com/sites/GrueneWeltweit/Washington/newtestwebstudio#/whlen-aus-dem-ausland-vereinfachen"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-6 px-6 text-center font-semibold text-white transition-opacity hover:opacity-95"
                style={{ backgroundColor: '#0f3ea9', minHeight: '50px', fontSize: '21px', lineHeight: 1.1 }}
            >
                <span>Warum eigentlich aus dem Ausland wählen? Es gibt 1000 gute Gründe ...</span>
                <span aria-hidden="true" style={{ fontSize: '28px', lineHeight: 1 }}>›</span>
            </a>

            <div className="mt-4 mb-3 flex justify-between gap-4">
                <h1 className="font-extrabold !text-[58px]" style={{ color: '#015a44', lineHeight: 1.05 }}>
                    Europawahl 2024 - Briefwahl Suchmaschine
                </h1>
                <div className="shrink-0 flex justify-center" style={{ width: '200px' }}>
                    <a
                        href="https://www.gruene-washington.de/BriefwahlSearch"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img
                            src="https://gruene-washington.de/Site%20Collection%20Images/ICONS/Stoerer_Briefwahl_RGB.png"
                            alt="Briefwahl jetzt"
                            className="object-contain"
                            style={{ width: '155px', height: '155px' }}
                        />
                    </a>
                </div>
            </div>

            <div className="flex items-start gap-4">
                <div className="relative min-w-0 flex-1">
                    <div className="absolute left-0 top-4 z-20 flex items-center justify-center border border-[#d1d1d1] bg-white shadow-sm" style={{ width: '160px', height: '220px' }}>
                        <div
                            className="flex items-center justify-center"
                            style={{ backgroundColor: '#14893f', transform: 'rotate(45deg)', width: '118px', height: '118px' }}
                        >
                            <span
                                className="text-center font-bold leading-tight text-white"
                                style={{ transform: 'rotate(-45deg)', fontSize: '22px' }}
                            >
                                {regionBadge === 'Washington D.C.' ? (
                                    <>
                                        Washington
                                        <br />
                                        D.C.
                                    </>
                                ) : (
                                    regionBadge
                                )}
                            </span>
                        </div>
                    </div>

                    <GermanyMap selectedState={selectedState} onStateClick={(state: string) => setSelectedState(state)} uniformFill />
                </div>

                <div className="shrink-0 pt-1" style={{ width: '200px' }}>
                    <div className="space-y-1.5">
                    {EU_STATES.map((state) => (
                        <button
                            key={state}
                            type="button"
                            onClick={() => window.open('https://gruene-weltweit.de/Briefwahl', '_blank', 'noopener,noreferrer')}
                            className="w-full px-3 py-2 text-center font-bold text-white transition-colors"
                            style={{ backgroundColor: selectedState === state ? '#0b5b3b' : '#1e7f2f', fontSize: '16px', lineHeight: 1.1 }}
                            onMouseEnter={(e) => { if (selectedState !== state) e.currentTarget.style.backgroundColor = '#0b5b3b'; }}
                            onMouseLeave={(e) => { if (selectedState !== state) e.currentTarget.style.backgroundColor = '#1e7f2f'; }}
                        >
                            {state}
                        </button>
                    ))}
                    </div>
                </div>
            </div>
            </div>
        </section>
    );
};

export default EuropawahlPortal;
