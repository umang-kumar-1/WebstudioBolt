import React, { useState } from 'react';
import './CSS/Briefwahl.css';

const BriefwahlPopup = (props: any) => {
    const [showModal] = useState(props.showModal);
    const [showModal1] = useState(props.showModal1);
    const [showModal2] = useState(props.showModal2);

    const cancelbox = () => {
        props.cancelbox();
    };

    const ModalPopup = () => {
        return (
            <><div id="box1content" className={`modal  ${showModal ? 'show' : ''}`} role="dialog" style={{ display: showModal ? 'block' : 'none' }}>
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 className="col"><span className="subtext">Anleitung Briefwahl <br /></span> Bin in Deutschland gemeldet</h3>
                            <a className="text-dark" onClick={cancelbox}><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1.5em" width="1.5em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368 144 144m224 0L144 368"></path></svg></a>
                        </div>
                        <div className="modal-body">
                            <div className="flex-20">
                                <strong>Finde den Briefwahl-Antrag mit der Grüne Weltweit <a href="https://www.gruene-weltweit.de/Briefwahl" target="_blank">Briefwahl-Suchmaschine</a></strong>
                                <div className="flex-steps">
                                    <span className="flex-step">
                                        <span className="flex-steps-icon">
                                            1
                                        </span>
                                        <span className='flex-steps-text'>Gib Deine Stadt,<br></br>Gemeinde oder PLZ ein</span>
                                    </span>
                                    <span className="flex-steps-arrow">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="33" viewBox="0 0 32 33" fill="none">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M24.6666 16.8374L16.7793 8.50032L15.6026 9.61146L21.6669 15.8835H7.33325V17.6677H21.6669L15.6026 24.0559L16.7793 25.167L24.6666 16.8374Z" fill="#333333" /></svg>
                                    </span>
                                    <span className="flex-step">
                                        <span className="flex-steps-icon">
                                            2
                                        </span>
                                        <span className='flex-steps-text'>Wähle den Online-Link<br></br>oder E-Mail</span>
                                    </span>
                                    <span className="flex-steps-arrow">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="33" viewBox="0 0 32 33" fill="none">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M24.6666 16.8374L16.7793 8.50032L15.6026 9.61146L21.6669 15.8835H7.33325V17.6677H21.6669L15.6026 24.0559L16.7793 25.167L24.6666 16.8374Z" fill="#333333" /></svg>
                                    </span>
                                    <span className="flex-step">
                                        <span className="flex-steps-icon">
                                            3
                                        </span>
                                        <span className='flex-steps-text'>Beantrage <br></br>Deine Unterlagen</span>
                                    </span>
                                </div>
                                {/* <span className='flex-20-text'>Online-Formular der Melde-Gemeinde in <a href="https://www.gruene-weltweit.de/Briefwahl" target="_blank"><strong>Grüne Weltweit Briefwahl-Suchmaschine</strong></a> finden:</span> */}
                            </div>
                            <div className="bannerlinks">
                                <div className="bannerlinksWithList">
                                    <a onClick={cancelbox} className='bannerlinksWithListTxt'>
                                        Per Online-Antrag
                                    </a>
                                    <ul className="banner-list" >
                                        <li>Online-Formular ausfüllen</li>
                                        <li>Unterlagen werden kostenlos zugeschickt</li>
                                    </ul>
                                </div>
                                <div className="bannerlinksWithList mb-1">
                                    <a onClick={cancelbox} className='bannerlinksWithListTxt'>
                                        Per formloser Email
                                    </a>
                                    <ul className="banner-list">
                                        <li>Inhalt: Familienname, Vorname(n), Geburtsdatum, Anschrift</li>
                                        <li>Unterlagen werden kostenlos zugeschickt</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="ExpandLinkFooterr"><a className="footer_textRight" href='https://www.bundeswahlleiterin.de/bundestagswahlen/2025/informationen-waehler/briefwahl.html' target="_blank" rel="noopener noreferrer">Informationen der Bundeswahlleiterin</a></div>
                    </div>
                </div>
            </div>
                <div id="box2content" className={`modal ${showModal1 ? 'show' : ''}`} role="dialog" style={{ display: showModal1 ? 'block' : 'none' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3 className="col"><span className="subtext">Anleitung Briefwahl <br /></span>Nicht mehr in Deutschland gemeldet</h3>
                                <a className="text-dark" onClick={cancelbox}><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1.5em" width="1.5em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368 144 144m224 0L144 368"></path></svg></a>
                            </div>
                            <div className="modal-body">
                                <div className="flex-8">
                                    <strong>Anleitung zum Eintrag ins Wähler*innenverzeichnis</strong>
                                    <span>Wer nicht mehr in Deutschland gemeldet ist muss den Eintrag ins Wähler*innenverzeichnis beantragen. Zuständig ist die Gemeinde, bei der man zuletzt gemeldet war.</span>
                                </div>
                                <div className="links">
                                    <strong>Antrag als Download:</strong>
                                    {/* <a className="linkWithText text-dark">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none">
                                            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 4.5L21.25 20.5H2.75L12 4.5ZM4.62748 19.4272H19.3725L12 6.67465L4.62748 19.4272ZM11.4532 15.8868V11.3807H12.5468V15.8868H11.4532ZM11.4532 17.8179V16.9596H12.5468V17.8179H11.4532Z" fill="#333333" />
                                        </svg>Muss bei jeder Wahl neu gemacht werden!</a> */}
                                    <a className="linkWithText text-dark" target="_blank" href="https://www.bundeswahlleiterin.de/dam/jcr/dc589523-d709-4c43-adbc-9342dda468ad/bwo_anlage-2_ausfuellbar.pdf"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none">
                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M11.999 16.5629L17.1729 11.2966L16.3419 10.4458L12.591 14.1742V5H11.4095V14.2065L7.67635 10.4073L6.8297 11.3013L11.999 16.5629ZM4 20V16.2675H5.209V18.7237H18.7871V16.2675H20V19.9768L4 20Z" fill="#333333" />
                                    </svg>Variante 1: frühere Wohnung / früherer gewöhnlicher Aufenthalt in Deutschland
                                    </a>
                                    <a className="linkWithText text-dark" target="_blank" href="https://www.bundeswahlleiterin.de/dam/jcr/af77d699-761b-4ff1-9c8b-1cdeb864818c/bwo_anlage-2a_ausfuellbar.pdf"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="25" viewBox="0 0 24 25" fill="none">
                                        <path fill-rule="evenodd" clip-rule="evenodd" d="M11.999 16.5629L17.1729 11.2966L16.3419 10.4458L12.591 14.1742V5H11.4095V14.2065L7.67635 10.4073L6.8297 11.3013L11.999 16.5629ZM4 20V16.2675H5.209V18.7237H18.7871V16.2675H20V19.9768L4 20Z" fill="#333333" />
                                    </svg>Variante 2 (nur postalisch einreichbar!): Vertrautheit mit den politischen Verhältnissen
                                    </a>
                                </div>
                                <div className="flex-12">
                                    <span>Zu schicken an: die für die letzte Meldeadresse zuständige Behörde postalisch im Original oder neu nur für Variante 1 per Fax, <a target="_blank" href="https://gruene-weltweit.de/Briefwahl">E-Mail</a></span>
                                    <span className='text-danger'>Frist: Sonntag, 2. Februar 2025 (Eingangsdatum bei der Behörde)</span>
                                    <span>Mit dem Eintrag werden die Briefwahlunterlagen automatisch mitbeantragt.</span>
                                    <a target="_blank" href="https://www.bundeswahlleiterin.de/bundestagswahlen/2025/informationen-waehler/deutsche-im-ausland.html">Weitere Informationen: Bundeswahlleiterin - Deutsche im Ausland</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="box3content" className={`modal ${showModal2 ? 'show' : ''}`} role="dialog" style={{ display: showModal2 ? 'block' : 'none' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3 className="col"><span className="subtext">Anleitung Briefwahl: <br /></span>Wahlunterlagen schnell zurück</h3>
                                <a className="text-dark" onClick={cancelbox}><svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1.5em" width="1.5em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M368 368 144 144m224 0L144 368"></path></svg></a>
                            </div>
                            <div className="modal-body">
                                <span>Die Herausforderung für Deutsche im Ausland bei Wahlen generell und dieser Wahl im Besonderen sind die langen Postlaufzeiten. Grüne-Weltweit gibt Euch ein paar Ideen, was ihr machen könnt, damit die Unterlagen doch rechtzeitig ankommen:</span>
                                <ul className='numbered-list'>
                                    <li>Nutzt die Wahlkuriere der deutschen Botschaften - <a href='https://gruene-weltweit.de/briefwahl/botschaftskuriere' target='_blank'>jetzt in beide Richtungen möglich!</a></li>
                                    <li>Schließt Euch mit anderen zusammen und verschickt die Unterlagen gemeinsam per Kurierpost</li>
                                    <li>Koordiniert Euch mit anderen Deutschen vor Ort, die vor der Wahl noch nach Deutschland reisen</li>
                                    <li>Wer vor der Wahl nochmals in Deutschland ist, kann im Antrag auf Erteilung eines Wahlscheins auch angeben, die Briefwahlunterlagen direkt beim Wahlamt abzuholen, oder den Antrag persönlich dort stellen. Vor Ort kann man den Stimmzettel ausfüllen und den Wahlbrief direkt abgeben</li>
                                </ul>
                                <span>Der <a className='' href='http://www.gruene-washington.de/' target="_blank" rel="noopener noreferrer">Grüne Ortsverband in Washington D.C.</a> hat in der Vergangenheit die Unterlagen von Mitgliedern und Freunden vor der Wahl mitgenommen und wird das auch dieses Mal machen. Grüne Weltweit hilft Euch gerne dabei, dies auch in anderen Regionen zu koordinieren. Alle Informationen hierzu werden wir laufend auf <a className='' href='http://www.gruene-weltweit.de/rechtzeitig-ankommen' target="_blank" rel="noopener noreferrer">www.gruene-weltweit.de/rechtzeitig-ankommen</a> aktualisieren.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <>
            <ModalPopup />
        </>
    );
}

export default BriefwahlPopup;
