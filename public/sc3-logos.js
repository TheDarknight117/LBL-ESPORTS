/**
 * sc3-logos.js
 * Catálogo oficial y resolución unificada de logos locales PNG para Copa Legion x Torneo Scouting 3
 * Permite renderizado instantáneo en alta resolución sin depender de URLs externas de Google Drive.
 */

const LOCAL_SC3_LOGOS = {
    "armeros gaming": "/assets/Equipos%20SC3/armeros%20gaming.png",
    "asociacion de troncos": "/assets/Equipos%20SC3/asociacion%20de%20troncos.png",
    "asociacion de troncos expertos": "/assets/Equipos%20SC3/asociacion%20de%20troncos.png",
    "b1 lol sport": "/assets/Equipos%20SC3/B1%20LoL%20sport.png",
    "b1 lol sports": "/assets/Equipos%20SC3/B1%20LoL%20sport.png",
    "b1 lol esports": "/assets/Equipos%20SC3/B1%20LoL%20sport.png",
    "b1": "/assets/Equipos%20SC3/B1%20LoL%20sport.png",
    "bolitas": "/assets/Equipos%20SC3/bolitas.png",
    "bolitoons": "/assets/Equipos%20SC3/bolitoons.png",
    "camino a laja reformed": "/assets/Equipos%20SC3/camino%20a%20laja%20reformed.png",
    "camino a laja": "/assets/Equipos%20SC3/camino%20a%20laja%20reformed.png",
    "ctk gaming": "/assets/Equipos%20SC3/CTK%20gaming.png",
    "ctk": "/assets/Equipos%20SC3/CTK%20gaming.png",
    "dead players gaming": "/assets/Equipos%20SC3/DEAD%20PLAYERS%20GAMING.png",
    "dead players": "/assets/Equipos%20SC3/DEAD%20PLAYERS%20GAMING.png",
    "dissidents": "/assets/Equipos%20SC3/dissidents.png",
    "inka warriors gaming": "/assets/Equipos%20SC3/Inka%20Warriors%20gaming.png",
    "inka warriors": "/assets/Equipos%20SC3/Inka%20Warriors%20gaming.png",
    "iron academy": "/assets/Equipos%20SC3/iron%20academy.png",
    "iron hells academy": "/assets/Equipos%20SC3/iron%20academy.png",
    "iron hells": "/assets/Equipos%20SC3/iron%20hells.png",
    "itsd zaun": "/assets/Equipos%20SC3/ITSD%20ZAUN.png",
    "itsd": "/assets/Equipos%20SC3/ITSD%20ZAUN.png",
    "kaox las": "/assets/Equipos%20SC3/KAOX%20LAS.png",
    "kaox": "/assets/Equipos%20SC3/KAOX%20LAS.png",
    "kaoxitos skyblue": "/assets/Equipos%20SC3/Kaoxitos%20Skyblue.png",
    "kaoxitos skyblue (academy)": "/assets/Equipos%20SC3/Kaoxitos%20Skyblue.png",
    "kaoxitos": "/assets/Equipos%20SC3/Kaoxitos%20Skyblue.png",
    "legion": "/assets/Equipos%20SC3/LEGION.png",
    "los chipis": "/assets/Equipos%20SC3/LOS%20CHIPIS.png",
    "chipis": "/assets/Equipos%20SC3/LOS%20CHIPIS.png",
    "new rapture sport": "/assets/Equipos%20SC3/New%20Rapture%20Sport.png",
    "new rapture sports": "/assets/Equipos%20SC3/New%20Rapture%20Sport.png",
    "new rapture esports": "/assets/Equipos%20SC3/New%20Rapture%20Sport.png",
    "new rapture": "/assets/Equipos%20SC3/New%20Rapture%20Sport.png",
    "nexus breakers": "/assets/Equipos%20SC3/Nexus%20breakers.png",
    "nothing cash": "/assets/Equipos%20SC3/Nothing%20Cash.png",
    "nox reign esports": "/assets/Equipos%20SC3/NOX%20REIGN%20ESPORTS.png",
    "nox reign": "/assets/Equipos%20SC3/NOX%20REIGN%20ESPORTS.png",
    "pacha lovers": "/assets/Equipos%20SC3/Pacha%20Lovers.png",
    "pachalovers": "/assets/Equipos%20SC3/Pacha%20Lovers.png",
    "pasteurizados gaming": "/assets/Equipos%20SC3/Pasteurizados%20Gaming.png",
    "pasteurizados": "/assets/Equipos%20SC3/Pasteurizados%20Gaming.png",
    "pent-hexch": "/assets/Equipos%20SC3/PENT-HEXCH.png",
    "pent hexch": "/assets/Equipos%20SC3/PENT-HEXCH.png",
    "phoenix rampage": "/assets/Equipos%20SC3/Phoenix%20Rampage.png",
    "phoenix rising gaming": "/assets/Equipos%20SC3/Phoenix%20Rising%20Gaming.png",
    "phoenix rising": "/assets/Equipos%20SC3/Phoenix%20Rising%20Gaming.png",
    "pisa patitos gaming": "/assets/Equipos%20SC3/PISA%20PATITOS%20GAMING.png",
    "pisa patitos": "/assets/Equipos%20SC3/PISA%20PATITOS%20GAMING.png",
    "postrecitos gaming": "/assets/Equipos%20SC3/Postrecitos%20Gaming.png",
    "postrecitos": "/assets/Equipos%20SC3/Postrecitos%20Gaming.png",
    "proyecto q": "/assets/Equipos%20SC3/proyecto%20Q.png",
    "rgb": "/assets/Equipos%20SC3/RGB.png",
    "rgb esports": "/assets/Equipos%20SC3/RGB.png",
    "rift rangers alpha": "/assets/Equipos%20SC3/rift%20rangers%20alpha.png",
    "rift rangers": "/assets/Equipos%20SC3/rift%20rangers%20alpha.png",
    "shadowborns gaming": "/assets/Equipos%20SC3/Shadowborns%20Gaming.png",
    "shadowborns": "/assets/Equipos%20SC3/Shadowborns%20Gaming.png",
    "siloko": "/assets/Equipos%20SC3/siloko.png",
    "snake nest": "/assets/Equipos%20SC3/snake%20nest.png",
    "sword art online": "/assets/Equipos%20SC3/Sword%20Art%20Online.png",
    "team blood": "/assets/Equipos%20SC3/Team%20Blood.png",
    "blood": "/assets/Equipos%20SC3/Team%20Blood.png",
    "tragedy": "/assets/Equipos%20SC3/tragedy.png",
    "triple alianza": "/assets/Equipos%20SC3/TRIPLE%20ALIANZA.png",
    "turnalia": "/assets/Equipos%20SC3/Turnalia.png",
    "voiden abyss club": "/assets/Equipos%20SC3/Voiden%20Abyss%20club.png",
    "voiden abyss": "/assets/Equipos%20SC3/Voiden%20Abyss%20club.png",
    "las cabras de lugano": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "cabras de lugano": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "las cabras de laguno": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "cabras de laguno": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "laguno": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "lugano": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "cabras": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "los 420": "/assets/Equipos%20SC3/Los%20420.png",
    "patitos gaming": "/assets/Equipos%20SC3/PATITOS%20GAMING.png",
    "rift rangers (omega)": "/assets/Equipos%20SC3/RIFT%20RANGERS%20(OMEGA).png",
    "rift rangers omega": "/assets/Equipos%20SC3/RIFT%20RANGERS%20(OMEGA).png",
    "revelation gaming": "/assets/Equipos%20SC3/Revelation%20Gaming.png",
    "revelation": "/assets/Equipos%20SC3/Revelation%20Gaming.png",
    "sindicato de eie": "/assets/Equipos%20SC3/Sindicato%20de%20EIE.png",
    "sindicato eie": "/assets/Equipos%20SC3/Sindicato%20de%20EIE.png",
    "sindicato wilcard": "/assets/Equipos%20SC3/Sindicato%20wilcard.png",
    "sindicato wildcard": "/assets/Equipos%20SC3/Sindicato%20wilcard.png",
    "souls reaper": "/assets/Equipos%20SC3/Souls%20Reaper.png",
    "soul reaper": "/assets/Equipos%20SC3/Souls%20Reaper.png",
    "the saviors": "/assets/Equipos%20SC3/THE%20SAVIORS.png",
    "saviors": "/assets/Equipos%20SC3/THE%20SAVIORS.png",
    "the low project": "/assets/Equipos%20SC3/The%20Low%20Project.png",
    "low project": "/assets/Equipos%20SC3/The%20Low%20Project.png",
    "the simpson": "/assets/Equipos%20SC3/The%20Simpson.png",
    "the simpsons": "/assets/Equipos%20SC3/The%20Simpson.png",
    "simpson": "/assets/Equipos%20SC3/The%20Simpson.png",

    // Acrónimos / Tags Oficiales
    "arg": "/assets/Equipos%20SC3/armeros%20gaming.png",
    "ate": "/assets/Equipos%20SC3/asociacion%20de%20troncos.png",
    "blt": "/assets/Equipos%20SC3/bolitas.png",
    "bol": "/assets/Equipos%20SC3/bolitoons.png",
    "clr": "/assets/Equipos%20SC3/camino%20a%20laja%20reformed.png",
    "dpg": "/assets/Equipos%20SC3/DEAD%20PLAYERS%20GAMING.png",
    "dis": "/assets/Equipos%20SC3/dissidents.png",
    "iwg": "/assets/Equipos%20SC3/Inka%20Warriors%20gaming.png",
    "iha": "/assets/Equipos%20SC3/iron%20academy.png",
    "ih": "/assets/Equipos%20SC3/iron%20hells.png",
    "itsd": "/assets/Equipos%20SC3/ITSD%20ZAUN.png",
    "kxa": "/assets/Equipos%20SC3/Kaoxitos%20Skyblue.png",
    "leg": "/assets/Equipos%20SC3/LEGION.png",
    "lgn": "/assets/Equipos%20SC3/LEGION.png",
    "chp": "/assets/Equipos%20SC3/LOS%20CHIPIS.png",
    "nre": "/assets/Equipos%20SC3/NOX%20REIGN%20ESPORTS.png",
    "nox": "/assets/Equipos%20SC3/NOX%20REIGN%20ESPORTS.png",
    "nrs": "/assets/Equipos%20SC3/New%20Rapture%20Sport.png",
    "nb": "/assets/Equipos%20SC3/Nexus%20breakers.png",
    "nc": "/assets/Equipos%20SC3/Nothing%20Cash.png",
    "ntc": "/assets/Equipos%20SC3/Nothing%20Cash.png",
    "plf": "/assets/Equipos%20SC3/Pacha%20Lovers.png",
    "pcl": "/assets/Equipos%20SC3/Pacha%20Lovers.png",
    "ptz": "/assets/Equipos%20SC3/Pasteurizados%20Gaming.png",
    "phx": "/assets/Equipos%20SC3/PENT-HEXCH.png",
    "pr": "/assets/Equipos%20SC3/Phoenix%20Rampage.png",
    "prg": "/assets/Equipos%20SC3/Phoenix%20Rising%20Gaming.png",
    "ppg": "/assets/Equipos%20SC3/PISA%20PATITOS%20GAMING.png",
    "ptg": "/assets/Equipos%20SC3/Postrecitos%20Gaming.png",
    "pq": "/assets/Equipos%20SC3/proyecto%20Q.png",
    "rra": "/assets/Equipos%20SC3/rift%20rangers%20alpha.png",
    "sbg": "/assets/Equipos%20SC3/Shadowborns%20Gaming.png",
    "slk": "/assets/Equipos%20SC3/siloko.png",
    "snk": "/assets/Equipos%20SC3/snake%20nest.png",
    "sao": "/assets/Equipos%20SC3/Sword%20Art%20Online.png",
    "tb": "/assets/Equipos%20SC3/Team%20Blood.png",
    "tgd": "/assets/Equipos%20SC3/tragedy.png",
    "ta": "/assets/Equipos%20SC3/TRIPLE%20ALIANZA.png",
    "trn": "/assets/Equipos%20SC3/Turnalia.png",
    "vac": "/assets/Equipos%20SC3/Voiden%20Abyss%20club.png",
    "rro": "/assets/Equipos%20SC3/RIFT%20RANGERS%20(OMEGA).png",
    "rvg": "/assets/Equipos%20SC3/Revelation%20Gaming.png",
    "eie": "/assets/Equipos%20SC3/Sindicato%20de%20EIE.png",
    "swc": "/assets/Equipos%20SC3/Sindicato%20wilcard.png",
    "sr": "/assets/Equipos%20SC3/Souls%20Reaper.png",
    "tsv": "/assets/Equipos%20SC3/THE%20SAVIORS.png",
    "tlp": "/assets/Equipos%20SC3/The%20Low%20Project.png",
    "smp": "/assets/Equipos%20SC3/The%20Simpson.png",
    "lcl": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "420": "/assets/Equipos%20SC3/Los%20420.png",
    "las": "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png",
    "twd": "/assets/Equipos%20SC3/THE%20SAVIORS.png",
    "tsn": "/assets/Equipos%20SC3/The%20Simpson.png"
};

function findLocalSc3Logo(name, tag) {
    const cleanName = String(name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cleanTag = String(tag || '').toLowerCase().trim();

    // 1. Reglas prioritarias explícitas para prevenir colisiones:
    if (cleanTag === 'nre' || cleanName.includes('nox reign') || cleanName === 'nox') {
        return "/assets/Equipos%20SC3/NOX%20REIGN%20ESPORTS.png";
    }
    if (cleanTag === 'nrs' || cleanName.includes('rapture')) {
        return "/assets/Equipos%20SC3/New%20Rapture%20Sport.png";
    }
    if (cleanTag === 'plf' || cleanTag === 'pcl' || cleanName.includes('pacha')) {
        return "/assets/Equipos%20SC3/Pacha%20Lovers.png";
    }
    if (cleanTag === 'ntc' || cleanTag === 'nc' || cleanName.includes('nothing cash')) {
        return "/assets/Equipos%20SC3/Nothing%20Cash.png";
    }
    if (cleanTag === 'leg' || cleanTag === 'lgn' || cleanName === 'legion') {
        return "/assets/Equipos%20SC3/LEGION.png";
    }
    if (cleanTag === 'iha' || cleanName.includes('iron academy') || cleanName.includes('hells academy')) {
        return "/assets/Equipos%20SC3/iron%20academy.png";
    }
    if (cleanTag === 'ih' || cleanName === 'iron hells') {
        return "/assets/Equipos%20SC3/iron%20hells.png";
    }
    if (cleanTag === 'rro' || cleanName.includes('omega')) {
        return "/assets/Equipos%20SC3/RIFT%20RANGERS%20(OMEGA).png";
    }
    if (cleanTag === 'rra' || cleanName.includes('alpha')) {
        return "/assets/Equipos%20SC3/rift%20rangers%20alpha.png";
    }
    if (cleanName.includes('pisa patitos') || cleanTag === 'ppg') {
        return "/assets/Equipos%20SC3/PISA%20PATITOS%20GAMING.png";
    }
    if (cleanName.includes('patitos') && !cleanName.includes('postrecitos')) {
        return "/assets/Equipos%20SC3/PATITOS%20GAMING.png";
    }
    if (cleanTag === 'las' || cleanTag === 'lcl' || cleanName.includes('cabras') || cleanName.includes('laguno') || cleanName.includes('lugano')) {
        return "/assets/Equipos%20SC3/Las%20cabras%20de%20lugano.png";
    }
    if (cleanTag === 'twd' || cleanTag === 'tsv' || cleanName.includes('saviors')) {
        return "/assets/Equipos%20SC3/THE%20SAVIORS.png";
    }
    if (cleanTag === 'tsn' || cleanTag === 'smp' || cleanName.includes('simpson')) {
        return "/assets/Equipos%20SC3/The%20Simpson.png";
    }

    // 2. Coincidencia por tabla directa
    if (cleanName && LOCAL_SC3_LOGOS[cleanName]) return LOCAL_SC3_LOGOS[cleanName];
    if (cleanTag && LOCAL_SC3_LOGOS[cleanTag]) return LOCAL_SC3_LOGOS[cleanTag];

    // 3. Coincidencia por subcadena
    for (const [key, path] of Object.entries(LOCAL_SC3_LOGOS)) {
        if (key.length > 3 && (cleanName.includes(key) || key.includes(cleanName))) {
            return path;
        }
    }
    return null;
}

// Exposición global para navegador y soporte de módulos
if (typeof window !== 'undefined') {
    window.LOCAL_SC3_LOGOS = LOCAL_SC3_LOGOS;
    window.findLocalSc3Logo = findLocalSc3Logo;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LOCAL_SC3_LOGOS, findLocalSc3Logo };
}
