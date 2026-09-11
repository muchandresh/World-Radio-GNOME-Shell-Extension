/* radioService.js
 *
 * Comprehensive Radio Catalog, Radio Browser API, Favorites & Geolocation
 */

import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export const CURATED_STATIONS = [
    // North America - USA
    { name: "KEXP 90.3 FM", country: "United States", city: "Seattle, WA", lat: 47.62, lon: -122.35, url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3", tags: "Alternative, Indie", badge: "US" },
    { name: "Radio Paradise Main", country: "United States", city: "Borrego Springs, CA", lat: 33.25, lon: -116.37, url: "https://stream-uk1.radioparadise.com/aac-320", tags: "Eclectic Rock, Indie", badge: "US" },
    { name: "Classic Vinyl HD", country: "United States", city: "New York, NY", lat: 40.71, lon: -74.00, url: "https://icecast.walmradio.com:8443/classic", tags: "Classic Rock, Oldies", badge: "US" },
    { name: "SomaFM Groove Salad", country: "United States", city: "San Francisco, CA", lat: 37.77, lon: -122.41, url: "https://ice1.somafm.com/groovesalad-128-mp3", tags: "Ambient, Chillout", badge: "US" },
    { name: "KCRW 89.9 FM", country: "United States", city: "Los Angeles, CA", lat: 34.05, lon: -118.24, url: "https://kcrw.streamguys1.com/kcrw_192k_mp3_on_air", tags: "Indie, NPR, Culture", badge: "US" },
    { name: "WNYC 93.9 FM", country: "United States", city: "New York, NY", lat: 40.72, lon: -73.99, url: "https://fm939.wnyc.org/wnycfm-web", tags: "NPR, Talk, News", badge: "US" },
    { name: "WWOZ 90.7 FM New Orleans", country: "United States", city: "New Orleans, LA", lat: 29.95, lon: -90.07, url: "https://wwoz-sc.streamguys1.com/wwoz-hi.mp3", tags: "Jazz, Blues, Soul", badge: "US" },
    { name: "The Current 89.3", country: "United States", city: "Minneapolis, MN", lat: 44.97, lon: -93.26, url: "https://current.stream.publicradio.org/kcmp.mp3", tags: "Indie Rock, AAA", badge: "US" },
    { name: "KUTX 98.9 Austin", country: "United States", city: "Austin, TX", lat: 30.26, lon: -97.74, url: "https://kut.streamguys1.com/kutx-free", tags: "Austin Music, Indie", badge: "US" },
    { name: "Miami Bass FM", country: "United States", city: "Miami, FL", lat: 25.76, lon: -80.19, url: "https://ice64.securenetsystems.net/BASS", tags: "Electro, Bass, Dance", badge: "US" },

    // North America - Canada & Mexico
    { name: "Indie88 Toronto", country: "Canada", city: "Toronto", lat: 43.65, lon: -79.38, url: "https://stream.indie88.com/indie88", tags: "Indie Rock, Alternative", badge: "CA" },
    { name: "CKUA Radio", country: "Canada", city: "Edmonton", lat: 53.54, lon: -113.49, url: "https://ckua.streamguys1.com/live-mp3", tags: "Roots, Blues, Folk", badge: "CA" },
    { name: "Reactor 105.7 FM", country: "Mexico", city: "Mexico City", lat: 19.43, lon: -99.13, url: "https://s2.mexiradio.com:7002/live", tags: "Rock en Español, Indie", badge: "MX" },
    { name: "Ibero 90.9", country: "Mexico", city: "Mexico City", lat: 19.36, lon: -99.26, url: "https://ibero909.com.mx:8000/ibero909.mp3", tags: "Indie, University", badge: "MX" },

    // Europe - UK & Ireland
    { name: "BBC World Service", country: "United Kingdom", city: "London", lat: 51.50, lon: -0.12, url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service", tags: "News, Global, Talk", badge: "UK" },
    { name: "BBC Radio 1", country: "United Kingdom", city: "London", lat: 51.52, lon: -0.14, url: "https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one", tags: "Pop, Dance, Hits", badge: "UK" },
    { name: "BBC Radio 6 Music", country: "United Kingdom", city: "Salford", lat: 53.48, lon: -2.29, url: "https://stream.live.vc.bbcmedia.co.uk/bbc_6music", tags: "Alternative, Post-Punk", badge: "UK" },
    { name: "RTE Radio 1", country: "Ireland", city: "Dublin", lat: 53.34, lon: -6.26, url: "https://icecast2.rte.ie/radio1", tags: "Irish News, Culture", badge: "IE" },

    // Europe - France, Germany, Netherlands, Switzerland, Austria
    { name: "FIP Radio", country: "France", city: "Paris", lat: 48.85, lon: 2.35, url: "https://icecast.radiofrance.fr/fip-midfi.mp3", tags: "Eclectic, Jazz, Groove", badge: "FR" },
    { name: "France Inter", country: "France", city: "Paris", lat: 48.86, lon: 2.28, url: "https://icecast.radiofrance.fr/franceinter-midfi.mp3", tags: "Generalist, French Culture", badge: "FR" },
    { name: "Radio Nova Paris", country: "France", city: "Paris", lat: 48.87, lon: 2.37, url: "https://novazz.ice.infomaniak.ch/novazz-128.mp3", tags: "Hip-Hop, Funk, World", badge: "FR" },
    { name: "Antenne Bayern", country: "Germany", city: "Munich", lat: 48.13, lon: 11.58, url: "https://s7-webradio.antenne.de/antenne", tags: "Top 40, Pop, Hits", badge: "DE" },
    { name: "Deutschlandfunk DLF", country: "Germany", city: "Berlin", lat: 52.52, lon: 13.40, url: "https://st01.sslstream.dlf.de/dlf/01/128/mp3/", tags: "German News, Culture", badge: "DE" },
    { name: "FluxFM Berlin", country: "Germany", city: "Berlin", lat: 52.50, lon: 13.44, url: "https://fluxfm.streamguys1.com/flux-live", tags: "Indie, Alternative, Berlin", badge: "DE" },
    { name: "Sublime FM", country: "Netherlands", city: "Amsterdam", lat: 52.36, lon: 4.90, url: "https://stream.sublime.nl/sublime_mp3", tags: "Funk, Soul, Jazz", badge: "NL" },
    { name: "Radio Swiss Pop", country: "Switzerland", city: "Bern", lat: 46.94, lon: 7.44, url: "https://stream.srg-ssr.ch/m/rsp/mp3_128", tags: "Pop, Soft Rock, Hits", badge: "CH" },
    { name: "FM4 ORF", country: "Austria", city: "Vienna", lat: 48.20, lon: 16.37, url: "https://orf-live.ors-shoutcast.at/fm4-q2a", tags: "Alternative, Electronic", badge: "AT" },
    { name: "Studio Brussel", country: "Belgium", city: "Brussels", lat: 50.85, lon: 4.35, url: "https://icecast.vrtcdn.be/stubru-high.mp3", tags: "Alternative Rock, Dance", badge: "BE" },

    // Europe - South & North
    { name: "Radio Ibiza Global", country: "Spain", city: "Ibiza", lat: 38.90, lon: 1.43, url: "https://stream.mediasector.es/radio/8000/ibizaglobalradio.mp3", tags: "House, Deep, Electronic", badge: "ES" },
    { name: "Radio 3 RNE", country: "Spain", city: "Madrid", lat: 40.41, lon: -3.70, url: "https://rtvelivestream.akamaized.net/rne_r3_main.mp3", tags: "Indie, Culture, Spanish", badge: "ES" },
    { name: "Radio Rai 1", country: "Italy", city: "Rome", lat: 41.90, lon: 12.49, url: "https://icstream.rai.it/1.mp3", tags: "News, Italian, Culture", badge: "IT" },
    { name: "Radio Monte Carlo Italy", country: "Italy", city: "Milan", lat: 45.46, lon: 9.19, url: "https://ice02.fluidstream.net/rmc.mp3", tags: "Lounge, Soul, Pop", badge: "IT" },
    { name: "Rádio Renascença", country: "Portugal", city: "Lisbon", lat: 38.72, lon: -9.13, url: "https://stream-rr.rr.pt/rr.mp3", tags: "Pop, News, Hits", badge: "PT" },
    { name: "En Lefko 87.7", country: "Greece", city: "Athens", lat: 37.98, lon: 23.72, url: "https://stream.radiojar.com/enlefko877", tags: "Eclectic, Indie, Lounge", badge: "GR" },
    { name: "Sveriges Radio P3", country: "Sweden", city: "Stockholm", lat: 59.32, lon: 18.06, url: "https://sverigesradio.se/topsy/direkt/srapi/164.mp3", tags: "Pop, Swedish Hits", badge: "SE" },
    { name: "NRK P13", country: "Norway", city: "Oslo", lat: 59.91, lon: 10.75, url: "https://lyd.nrk.no/nrk_radio_p13_mp3_h", tags: "Rock, Indie, Nordic", badge: "NO" },
    { name: "Radio 357", country: "Poland", city: "Warsaw", lat: 52.22, lon: 21.01, url: "https://stream.rcs.revma.com/ye5kghkgcm0uv", tags: "Indie Rock, Polish Talk", badge: "PL" },

    // Asia - India
    { name: "Radio Mirchi 98.3 FM", country: "India", city: "Delhi", lat: 28.61, lon: 77.20, url: "https://streams.radiomirchi.com/fm/delhi.mp3", tags: "Bollywood, Desi Hits, Pop", badge: "IN" },
    { name: "Radio City 91.1", country: "India", city: "Mumbai", lat: 19.07, lon: 72.87, url: "https://stream.zeno.fm/fvrx452618uvv", tags: "Hindi Retro, Bollywood Hits", badge: "IN" },
    { name: "AIR Rainbow Bengaluru", country: "India", city: "Bengaluru", lat: 12.97, lon: 77.59, url: "https://air.pc.cdn.bitgravity.com/air/live/pcrradio_206/playlist.m3u8", tags: "Kannada, English Pop", badge: "IN" },
    { name: "Chennai Live 104.8", country: "India", city: "Chennai", lat: 13.08, lon: 80.27, url: "https://stream.zeno.fm/054tzcwy6p8uv", tags: "Tamil, English Talk", badge: "IN" },
    { name: "Mirchi Kolkata", country: "India", city: "Kolkata", lat: 22.57, lon: 88.36, url: "https://stream.zeno.fm/4mcvzcwkguquv", tags: "Bengali, Bollywood Hits", badge: "IN" },
    { name: "Radio Mirchi Hyderabad", country: "India", city: "Hyderabad", lat: 17.38, lon: 78.48, url: "https://stream.zeno.fm/hyderabad", tags: "Telugu, Tollywood Hits", badge: "IN" },

    // Asia - East & Southeast
    { name: "J-Pop Sakura 17", country: "Japan", city: "Tokyo", lat: 35.67, lon: 139.65, url: "https://cast1.torontocast.com:2160/stream", tags: "J-Pop, Anime Hits", badge: "JP" },
    { name: "Shonan Beach FM", country: "Japan", city: "Zushi", lat: 35.29, lon: 139.57, url: "https://musicbird.leanstream.co/JCB043-MP3", tags: "Jazz, Beach, Lounge", badge: "JP" },
    { name: "KBS Cool FM", country: "South Korea", city: "Seoul", lat: 37.56, lon: 126.97, url: "https://serpent0.duckdns.org:8088/kbs2fm.pls", tags: "K-Pop, Entertainment", badge: "KR" },
    { name: "Kiss 92 FM", country: "Singapore", city: "Singapore", lat: 1.35, lon: 103.81, url: "https://kiss92.rastream.com/kiss92", tags: "All-Time Favorites, Pop", badge: "SG" },
    { name: "Prambors FM Jakarta", country: "Indonesia", city: "Jakarta", lat: -6.20, lon: 106.84, url: "https://stream.zeno.fm/u0b106q7fshvv", tags: "Indonesian Hits, Pop", badge: "ID" },
    { name: "Eazy FM 105.5 Bangkok", country: "Thailand", city: "Bangkok", lat: 13.75, lon: 100.50, url: "https://stream.zeno.fm/4d7qg0u2018uv", tags: "Thai Pop, International", badge: "TH" },
    { name: "Monster RX 93.1 Manila", country: "Philippines", city: "Manila", lat: 14.59, lon: 120.98, url: "https://icecast.eradioportal.com:8000/rx931", tags: "OPM, Pop, Hits", badge: "PH" },

    // Middle East
    { name: "Dubai 92", country: "United Arab Emirates", city: "Dubai", lat: 25.20, lon: 55.27, url: "https://stream.arn.ae/dubai92", tags: "Classic Hits, 80s/90s", badge: "AE" },
    { name: "Virgin Radio Dubai", country: "United Arab Emirates", city: "Dubai", lat: 25.07, lon: 55.14, url: "https://stream.arn.ae/vr", tags: "Top 40, EDM, Hits", badge: "AE" },
    { name: "Power FM Istanbul", country: "Turkey", city: "Istanbul", lat: 41.00, lon: 28.97, url: "https://listen.powerapp.com.tr/powerfm/mpeg/icecast.audio", tags: "Top 40, Dance Hits", badge: "TR" },
    { name: "Kan 88", country: "Israel", city: "Tel Aviv", lat: 32.08, lon: 34.78, url: "https://kanliveicy.media.kan.org.il/icy/kan88_mp3", tags: "Rock, Jazz, Eclectic", badge: "IL" },

    // South America
    { name: "Alpha FM 101.7", country: "Brazil", city: "São Paulo", lat: -23.55, lon: -46.63, url: "https://ice.fabricahost.com.br/alphafmsp", tags: "Pop, MPB, Soft Rock", badge: "BR" },
    { name: "JB FM 99.9", country: "Brazil", city: "Rio de Janeiro", lat: -22.90, lon: -43.17, url: "https://streaming.jbfm.com.br/jbfm", tags: "Bossa Nova, Pop, Easy", badge: "BR" },
    { name: "Radio Itatiaia", country: "Brazil", city: "Belo Horizonte", lat: -19.92, lon: -43.93, url: "https://icecast.itatiaia.com.br/itatiaia_am", tags: "Brazilian News, Culture", badge: "BR" },
    { name: "Aspen 102.3 FM", country: "Argentina", city: "Buenos Aires", lat: -34.60, lon: -58.38, url: "https://stream.aspen.telecom.com.ar/aspen", tags: "Classic Rock, 80s Hits", badge: "AR" },
    { name: "Radio Uno Bogota", country: "Colombia", city: "Bogota", lat: 4.71, lon: -74.07, url: "https://rcnmundo.com/radiouno.mp3", tags: "Vallenato, Salsa, Cumbia", badge: "CO" },
    { name: "Radio Oasis Lima", country: "Peru", city: "Lima", lat: -12.04, lon: -77.04, url: "https://stream.crp.pe/oasis.aac", tags: "Rock & Pop 80s/90s", badge: "PE" },
    { name: "Radio Concierto Santiago", country: "Chile", city: "Santiago", lat: -33.44, lon: -70.66, url: "https://prisa-cl.streamguys1.com/concierto", tags: "Pop, Alternative, Rock", badge: "CL" },

    // Africa
    { name: "947 Joburg", country: "South Africa", city: "Johannesburg", lat: -26.20, lon: 28.04, url: "https://primedia.rcs.revma.com/947", tags: "Hits, Top 40, Afrobeat", badge: "ZA" },
    { name: "KFM 94.5 Cape Town", country: "South Africa", city: "Cape Town", lat: -33.92, lon: 18.42, url: "https://primedia.rcs.revma.com/kfm", tags: "Contemporary, Pop Hits", badge: "ZA" },
    { name: "Nile FM 104.2", country: "Egypt", city: "Cairo", lat: 30.04, lon: 31.23, url: "https://audio.nrpstream.com/nilefm/mp3", tags: "Pop, Hits, English/Arabic", badge: "EG" },
    { name: "Cool FM 96.9 Lagos", country: "Nigeria", city: "Lagos", lat: 6.52, lon: 3.37, url: "https://stream.coolwazobiainfo.com/coolfm-lagos", tags: "Afrobeats, Hip-Hop", badge: "NG" },
    { name: "Capital FM Kenya", country: "Kenya", city: "Nairobi", lat: -1.29, lon: 36.82, url: "https://stream.capitalfm.co.ke/capitalfm", tags: "Hits, Afro-Pop, Rock", badge: "KE" },
    { name: "Joy FM Accra", country: "Ghana", city: "Accra", lat: 5.60, lon: -0.18, url: "https://stream.zeno.fm/05f27c8a4reuv", tags: "Afrobeats, Highlife, News", badge: "GH" },

    // Australia & Oceania
    { name: "Triple J", country: "Australia", city: "Sydney", lat: -33.86, lon: 151.20, url: "https://live-radio01.mediahubaustralia.com/2TJW/mp3/", tags: "Alternative, Aussie Indie", badge: "AU" },
    { name: "Gold 104.3 Melbourne", country: "Australia", city: "Melbourne", lat: -37.81, lon: 144.96, url: "https://arn.streamguys1.com/vic_mel_gold1043_aac", tags: "Classic Hits, 80s/90s", badge: "AU" },
    { name: "4ZZZ Brisbane 102.1", country: "Australia", city: "Brisbane", lat: -27.47, lon: 153.02, url: "https://stream.4zzz.org.au/4zzz", tags: "Community, Punk, Indie", badge: "AU" },
    { name: "RTRFM 92.1 Perth", country: "Australia", city: "Perth", lat: -31.95, lon: 115.86, url: "https://stream.rtrfm.com.au/live", tags: "Local Music, Electronic", badge: "AU" },
    { name: "George FM", country: "New Zealand", city: "Auckland", lat: -36.84, lon: 174.76, url: "https://stream.mediaworks.co.nz/george_128kbps", tags: "Electronic, Dance, D&B", badge: "NZ" },
    { name: "RNZ National", country: "New Zealand", city: "Wellington", lat: -41.28, lon: 174.77, url: "https://radionz-ice.streamguys.com/national.mp3", tags: "Public Radio, Kiwi Culture", badge: "NZ" },
];

export class RadioService {
    constructor() {
        this._session = new Soup.Session();
        this._stations = [...CURATED_STATIONS];
        this._userLocation = null;
        this._favorites = [];
        this._favFilePath = GLib.build_filenamev([GLib.get_user_config_dir(), 'world-radio-favorites.json']);
        this.loadFavorites();
    }

    get stations() {
        return this._stations;
    }

    get favorites() {
        return this._favorites;
    }

    loadFavorites() {
        try {
            const file = Gio.File.new_for_path(this._favFilePath);
            if (file.query_exists(null)) {
                const [, contents] = file.load_contents(null);
                const list = JSON.parse(new TextDecoder().decode(contents));
                if (Array.isArray(list)) {
                    this._favorites = list.slice(0, 4);
                    return;
                }
            }
        } catch (e) {
            console.warn('[WorldRadio] Error loading favorites:', e.message);
        }

        // Default initial 4 favorite presets
        this._favorites = [
            this._stations[0], // KEXP
            this._stations[14], // BBC World Service
            this._stations[18], // FIP Radio
            this._stations[32], // Radio Mirchi
        ];
        this.saveFavorites();
    }

    saveFavorites() {
        try {
            const file = Gio.File.new_for_path(this._favFilePath);
            const parent = file.get_parent();
            if (parent && !parent.query_exists(null)) {
                parent.make_directory_with_parents(null);
            }
            const data = JSON.stringify(this._favorites, null, 2);
            file.replace_contents(data, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            console.warn('[WorldRadio] Error saving favorites:', e.message);
        }
    }

    isFavorite(station) {
        if (!station) return false;
        return this._favorites.some(f => f.name === station.name || (f.url && f.url === station.url));
    }

    toggleFavorite(station) {
        if (!station) return false;
        const index = this._favorites.findIndex(f => f.name === station.name || (f.url && f.url === station.url));
        if (index >= 0) {
            this._favorites.splice(index, 1);
            this.saveFavorites();
            return false;
        } else {
            if (this._favorites.length >= 4) {
                // Remove the oldest to keep maximum 4
                this._favorites.shift();
            }
            this._favorites.push({
                name: station.name,
                url: station.url,
                lat: station.lat,
                lon: station.lon,
                country: station.country || '',
                city: station.city || '',
                tags: station.tags || '',
                badge: station.badge || '★',
            });
            this.saveFavorites();
            return true;
        }
    }

    detectLocation(callback) {
        const url = 'https://freeipapi.com/api/json';
        const msg = Soup.Message.new('GET', url);
        msg.request_headers.append('User-Agent', 'WorldRadio-GNOME/1.0');

        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, res) => {
            try {
                const bytes = session.send_and_read_finish(res);
                if (bytes) {
                    const text = new TextDecoder().decode(bytes.get_data());
                    const data = JSON.parse(text);
                    if (data && data.latitude !== undefined && data.longitude !== undefined) {
                        this._userLocation = {
                            lat: Number(data.latitude),
                            lon: Number(data.longitude),
                            city: data.cityName || '',
                            country: data.countryName || '',
                            countryCode: data.countryCode || '',
                        };
                        if (callback) callback(null, this._userLocation);
                        return;
                    }
                }
            } catch (e) {}

            this._detectLocationFallback(callback);
        });
    }

    _detectLocationFallback(callback) {
        const url = 'https://ipwho.is/';
        const msg = Soup.Message.new('GET', url);
        msg.request_headers.append('User-Agent', 'WorldRadio-GNOME/1.0');

        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, res) => {
            try {
                const bytes = session.send_and_read_finish(res);
                if (bytes) {
                    const text = new TextDecoder().decode(bytes.get_data());
                    const data = JSON.parse(text);
                    if (data && data.latitude !== undefined && data.longitude !== undefined) {
                        this._userLocation = {
                            lat: Number(data.latitude),
                            lon: Number(data.longitude),
                            city: data.city || '',
                            country: data.country || '',
                            countryCode: data.country_code || '',
                        };
                        if (callback) callback(null, this._userLocation);
                        return;
                    }
                }
            } catch (e) {}

            if (callback) callback(new Error('Could not resolve location'), null);
        });
    }

    fetchOnlineStations(callback) {
        const url = 'https://de1.api.radio-browser.info/json/stations/search?has_geo_info=true&limit=250&order=clickcount&reverse=true';
        const msg = Soup.Message.new('GET', url);
        msg.request_headers.append('User-Agent', 'WorldRadio-GNOME/1.0');

        this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null, (session, res) => {
            try {
                const bytes = session.send_and_read_finish(res);
                if (bytes) {
                    const text = new TextDecoder().decode(bytes.get_data());
                    const list = JSON.parse(text);
                    if (Array.isArray(list)) {
                        for (const item of list) {
                            const lat = Number(item.geo_lat);
                            const lon = Number(item.geo_long);
                            const streamUrl = item.url_resolved || item.url;
                            if (lat && lon && streamUrl && streamUrl.startsWith('http')) {
                                if (lat >= -88 && lat <= 88 && lon >= -180 && lon <= 180 && (Math.abs(lat) > 0.1 || Math.abs(lon) > 0.1)) {
                                    if (!this._stations.some(s => s.name === item.name || s.url === streamUrl)) {
                                        this._stations.push({
                                            name: item.name.trim(),
                                            country: item.country || '',
                                            city: item.state || '',
                                            lat: Math.round(lat * 100) / 100,
                                            lon: Math.round(lon * 100) / 100,
                                            url: streamUrl,
                                            tags: item.tags ? item.tags.slice(0, 45) : 'Online Stream',
                                            badge: item.countrycode || 'WW',
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[WorldRadio] Error fetching online radio-browser stations:', e.message);
            }

            if (callback) callback(this._stations);
        });
    }

    findNearestStation(lat, lon) {
        if (!this._stations || this._stations.length === 0) return null;

        const toRad = deg => (deg * Math.PI) / 180;
        const phi1 = toRad(lat);
        const lam1 = toRad(lon);

        let nearest = null;
        let minDist = Infinity;

        for (const station of this._stations) {
            const phi2 = toRad(station.lat);
            const lam2 = toRad(station.lon);

            const dphi = phi2 - phi1;
            const dlam = lam2 - lam1;
            const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            if (c < minDist) {
                minDist = c;
                nearest = station;
            }
        }

        return nearest;
    }
}
