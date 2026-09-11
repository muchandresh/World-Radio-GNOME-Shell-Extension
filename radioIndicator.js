/* radioIndicator.js
 *
 * PanelMenu indicator and 9:16 interactive card popup for World Radio
 * Includes:
 * - Dynamic placement for bottom/top panels (opens near globe icon)
 * - 4 Followed Stations presets & quick selector
 * - Accurate station streaming & status feedback
 * - Zoom depth & interactive 3D globe integration
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';

import {RadioPlayer, PlayState} from './radioPlayer.js';
import {RadioService} from './radioService.js';
import {GlobeView} from './globeView.js';

export const WorldRadioIndicator = GObject.registerClass({
    GTypeName: 'WorldRadioIndicator',
}, class WorldRadioIndicator extends PanelMenu.Button {
    _init(extension) {
        // Centered alignment on indicator
        super._init(0.5, 'World Radio', false);
        this._extension = extension;

        // Player & Data Service
        this._player = new RadioPlayer();
        this._service = new RadioService();
        this._currentStationIndex = 0;
        this._userLocation = null;

        // Build UI
        this._buildPanelButton();
        this._buildPopupMenu();

        // Connect player events
        this._player.connect('state-changed', (player, state) => {
            this._updatePlayerUI(state);
        });

        this._player.connect('meta-changed', (player, meta) => {
            if (meta && this._genreLabel && this._player.isPlaying) {
                this._genreLabel.set_text(`Now Playing: ${meta}`);
            }
        });

        // Track menu open to adjust position based on panel location (top/bottom)
        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._adjustMenuPosition();
            }
        });

        // Initialize geolocation & stations
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._initData();
            return GLib.SOURCE_REMOVE;
        });
    }

    _adjustMenuPosition() {
        const [stageX, stageY] = this.get_transformed_position();
        const [width, height] = this.get_transformed_size();
        const monitor = Main.layoutManager.findMonitorForActor(this) || Main.layoutManager.primaryMonitor;

        const centerY = stageY + height / 2;
        const isBottom = centerY > (monitor.y + monitor.height / 2);

        if (this.menu && this.menu._boxPointer) {
            this.menu._boxPointer.sourceActor = this;
            if (isBottom) {
                this.menu._boxPointer._userArrowSide = St.Side.BOTTOM;
                this.menu._arrowSide = St.Side.BOTTOM;
            } else {
                this.menu._boxPointer._userArrowSide = St.Side.TOP;
                this.menu._arrowSide = St.Side.TOP;
            }
            this.setSourceAlignment(0.5);
        }
    }

    _buildPanelButton() {
        const box = new St.BoxLayout({
            style_class: 'world-radio-panel-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const iconPath = `${this._extension.path}/icons/world-globe-symbolic.svg`;
        const iconFile = Gio.File.new_for_path(iconPath);
        if (iconFile.query_exists(null)) {
            const gicon = Gio.icon_new_for_string(iconPath);
            this._panelIcon = new St.Icon({
                gicon,
                style_class: 'world-radio-panel-icon',
            });
        } else {
            this._panelIcon = new St.Icon({
                icon_name: 'preferences-system-windows-symbolic',
                style_class: 'world-radio-panel-icon',
            });
        }
        box.add_child(this._panelIcon);

        this._panelLabel = new St.Label({
            text: '',
            style_class: 'world-radio-panel-label',
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        box.add_child(this._panelLabel);

        this.add_child(box);

        // Adjust position right before opening when clicked
        this.connect('button-press-event', () => {
            this._adjustMenuPosition();
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _buildPopupMenu() {
        this.menu.box.style_class = 'world-radio-menu';

        // 9:16 Aspect Ratio Main Card (350px x 620px)
        this._card = new St.BoxLayout({
            vertical: true,
            style_class: 'world-radio-card',
            width: 350,
            height: 620,
            x_expand: false,
            y_expand: false,
        });

        // 1. Header Row (Title & Action Buttons)
        const headerBox = new St.BoxLayout({
            style_class: 'world-radio-header',
            y_align: Clutter.ActorAlign.CENTER,
        });

        const titleLabel = new St.Label({
            text: 'World Radio',
            style_class: 'world-radio-title',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        headerBox.add_child(titleLabel);

        // Follow / Favorite current station button
        this._favBtn = new St.Button({
            style_class: 'world-radio-action-btn',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            margin_right: 6,
        });
        this._favIcon = new St.Icon({
            icon_name: 'starred-symbolic',
            icon_size: 16,
        });
        this._favBtn.set_child(this._favIcon);
        this._favBtn.connect('clicked', () => this._onToggleFavorite());
        headerBox.add_child(this._favBtn);

        // Locate Me Button
        this._locateBtn = new St.Button({
            style_class: 'world-radio-action-btn',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._locateBtn.set_child(new St.Icon({
            icon_name: 'find-location-symbolic',
            icon_size: 16,
        }));
        this._locateBtn.connect('clicked', () => this._onLocateClicked());
        headerBox.add_child(this._locateBtn);

        // Shuffle / Random Button
        this._shuffleBtn = new St.Button({
            style_class: 'world-radio-action-btn',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            margin_left: 6,
        });
        this._shuffleBtn.set_child(new St.Icon({
            icon_name: 'media-playlist-shuffle-symbolic',
            icon_size: 16,
        }));
        this._shuffleBtn.connect('clicked', () => this._onShuffleClicked());
        headerBox.add_child(this._shuffleBtn);

        this._card.add_child(headerBox);

        // 2. Subtitle / Status Row
        const subtitleBox = new St.BoxLayout({
            vertical: true,
            style_class: 'world-radio-subtitle-box',
        });

        const statusRow = new St.BoxLayout({
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._dotLabel = new St.Label({
            text: '⚪',
            style_class: 'world-radio-dot',
            y_align: Clutter.ActorAlign.CENTER,
        });
        statusRow.add_child(this._dotLabel);

        this._stationTitleLabel = new St.Label({
            text: 'Select a station on Earth',
            style_class: 'world-radio-status-text',
            y_align: Clutter.ActorAlign.CENTER,
        });
        statusRow.add_child(this._stationTitleLabel);
        subtitleBox.add_child(statusRow);

        this._genreLabel = new St.Label({
            text: 'Drag to spin, wheel to zoom, click red dot to play',
            style_class: 'world-radio-genre-text',
        });
        subtitleBox.add_child(this._genreLabel);

        this._card.add_child(subtitleBox);

        // 3. Followed Stations Presets (Up to 4 slots)
        const favContainer = new St.BoxLayout({
            vertical: true,
            style_class: 'world-radio-fav-container',
        });

        const favHeader = new St.BoxLayout({
            y_align: Clutter.ActorAlign.CENTER,
        });
        const favTitle = new St.Label({
            text: 'FOLLOWED STATIONS (UP TO 4)',
            style_class: 'world-radio-fav-title',
            x_expand: true,
        });
        favHeader.add_child(favTitle);
        favContainer.add_child(favHeader);

        this._favPillsBox = new St.BoxLayout({
            style_class: 'world-radio-fav-pills',
        });
        favContainer.add_child(this._favPillsBox);
        this._card.add_child(favContainer);

        // 4. Interactive 3D Globe View
        this._globeView = new GlobeView({
            height: 330,
            x_expand: true,
            y_expand: true,
            style_class: 'world-radio-globe-box',
        });

        this._globeView.connect('station-selected', (view, station) => {
            this._selectAndPlayStation(station);
        });

        this._globeView.connect('station-hovered', (view, station) => {
            if (station && !this._player.isPlaying) {
                this._stationTitleLabel.set_text(station.name);
                this._genreLabel.set_text(`${station.city ? station.city + ', ' : ''}${station.country} • ${station.tags}`);
            }
        });

        this._card.add_child(this._globeView);

        // 5. Media Controls Bar
        const controlsBox = new St.BoxLayout({
            style_class: 'world-radio-controls-box',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._prevBtn = new St.Button({
            style_class: 'world-radio-action-btn',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            margin_right: 18,
        });
        this._prevBtn.set_child(new St.Icon({
            icon_name: 'media-skip-backward-symbolic',
            icon_size: 18,
        }));
        this._prevBtn.connect('clicked', () => this._onPrevClicked());
        controlsBox.add_child(this._prevBtn);

        this._playBtn = new St.Button({
            style_class: 'world-radio-play-btn',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._playIcon = new St.Icon({
            icon_name: 'media-playback-start-symbolic',
            icon_size: 26,
        });
        this._playBtn.set_child(this._playIcon);
        this._playBtn.connect('clicked', () => this._onPlayToggle());
        controlsBox.add_child(this._playBtn);

        this._nextBtn = new St.Button({
            style_class: 'world-radio-action-btn',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            margin_left: 18,
        });
        this._nextBtn.set_child(new St.Icon({
            icon_name: 'media-skip-forward-symbolic',
            icon_size: 18,
        }));
        this._nextBtn.connect('clicked', () => this._onNextClicked());
        controlsBox.add_child(this._nextBtn);

        this._card.add_child(controlsBox);

        // 6. Volume Slider Row
        const volumeBox = new St.BoxLayout({
            style_class: 'world-radio-volume-box',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const volIcon = new St.Icon({
            icon_name: 'audio-volume-medium-symbolic',
            style_class: 'world-radio-volume-icon',
        });
        volumeBox.add_child(volIcon);

        this._volumeSlider = new Slider.Slider(0.8);
        this._volumeSlider.set_width(170);
        this._volumeSlider.y_align = Clutter.ActorAlign.CENTER;
        this._volumeSlider.connect('notify::value', () => {
            this._player.setVolume(this._volumeSlider.value);
        });
        volumeBox.add_child(this._volumeSlider);

        this._card.add_child(volumeBox);

        // 7. Footer Status Info
        this._footerLabel = new St.Label({
            text: 'Connecting to global radio network...',
            style_class: 'world-radio-footer-label',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._card.add_child(this._footerLabel);

        this.menu.box.add_child(this._card);
        this._renderFavoritePills();
    }

    _initData() {
        this._globeView.setStations(this._service.stations);
        this._renderFavoritePills();

        this._service.detectLocation((err, loc) => {
            if (!err && loc) {
                this._userLocation = loc;
                this._footerLabel.set_text(`Location: ${loc.city || loc.country} (${loc.lat.toFixed(1)}°, ${loc.lon.toFixed(1)}°)`);
                this._globeView.rotateTo(loc.lat, loc.lon, true);

                const nearest = this._service.findNearestStation(loc.lat, loc.lon);
                if (nearest) {
                    this._selectStationOnly(nearest);
                }
            } else {
                this._footerLabel.set_text('World Radio • Drag to spin, scroll to zoom');
            }
        });

        this._service.fetchOnlineStations((allStations) => {
            this._globeView.setStations(allStations);
            if (this._userLocation) {
                this._footerLabel.set_text(`${allStations.length} live stations online • Near ${this._userLocation.country || 'you'}`);
            } else {
                this._footerLabel.set_text(`${allStations.length} live stations online worldwide`);
            }
            this._renderFavoritePills();
        });
    }

    _renderFavoritePills() {
        this._favPillsBox.destroy_all_children();
        const favs = this._service.favorites;

        for (let i = 0; i < 4; i++) {
            const station = favs[i];
            const pill = new St.Button({
                style_class: station ? 'world-radio-fav-pill active' : 'world-radio-fav-pill empty',
                can_focus: true,
                x_expand: true,
            });

            const pillLabel = new St.Label({
                text: station ? `★ ${station.name.slice(0, 8)}` : `+ Slot ${i + 1}`,
                style_class: 'world-radio-fav-pill-label',
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
            });
            pill.set_child(pillLabel);

            pill.connect('clicked', () => {
                if (station) {
                    this._selectAndPlayStation(station);
                } else if (this._player.currentStation) {
                    this._service.toggleFavorite(this._player.currentStation);
                    this._renderFavoritePills();
                    this._updateFavButtonState();
                }
            });

            this._favPillsBox.add_child(pill);
        }

        this._updateFavButtonState();
    }

    _updateFavButtonState() {
        const current = this._player.currentStation;
        if (!current) {
            this._favBtn.style_class = 'world-radio-action-btn';
            return;
        }

        const isFav = this._service.isFavorite(current);
        if (isFav) {
            this._favBtn.style_class = 'world-radio-action-btn fav-active';
            this._favIcon.icon_name = 'starred-symbolic';
        } else {
            this._favBtn.style_class = 'world-radio-action-btn';
            this._favIcon.icon_name = 'non-starred-symbolic';
        }
    }

    _onToggleFavorite() {
        const current = this._player.currentStation;
        if (!current) return;

        this._service.toggleFavorite(current);
        this._renderFavoritePills();
        this._updateFavButtonState();
    }

    _selectStationOnly(station) {
        if (!station) return;
        this._currentStationIndex = this._service.stations.indexOf(station);
        if (this._currentStationIndex === -1) this._currentStationIndex = 0;

        this._globeView.setSelectedStation(station);
        this._stationTitleLabel.set_text(station.name);
        this._genreLabel.set_text(`${station.city ? station.city + ', ' : ''}${station.country || 'Worldwide'} • ${station.tags || 'Live'}`);
        this._updateFavButtonState();
    }

    _selectAndPlayStation(station) {
        if (!station) return;
        this._selectStationOnly(station);
        this._globeView.rotateTo(station.lat, station.lon, true);

        // Immediate responsive UI feedback
        this._dotLabel.set_text('🟡');
        this._genreLabel.set_text(`Connecting to ${station.name}...`);
        this._player.play(station);
    }

    _onPlayToggle() {
        if (this._player.isPlaying) {
            this._player.togglePause();
        } else {
            if (this._player.currentStation) {
                this._player.togglePause();
            } else if (this._service.stations.length > 0) {
                const station = this._service.stations[this._currentStationIndex] || this._service.stations[0];
                this._selectAndPlayStation(station);
            }
        }
    }

    _onPrevClicked() {
        const stations = this._service.stations;
        if (stations.length === 0) return;

        this._currentStationIndex = (this._currentStationIndex - 1 + stations.length) % stations.length;
        this._selectAndPlayStation(stations[this._currentStationIndex]);
    }

    _onNextClicked() {
        const stations = this._service.stations;
        if (stations.length === 0) return;

        this._currentStationIndex = (this._currentStationIndex + 1) % stations.length;
        this._selectAndPlayStation(stations[this._currentStationIndex]);
    }

    _onShuffleClicked() {
        const stations = this._service.stations;
        if (stations.length === 0) return;

        const randomIndex = Math.floor(Math.random() * stations.length);
        this._currentStationIndex = randomIndex;
        this._selectAndPlayStation(stations[randomIndex]);
    }

    _onLocateClicked() {
        if (this._userLocation) {
            this._globeView.rotateTo(this._userLocation.lat, this._userLocation.lon, true);
            const nearest = this._service.findNearestStation(this._userLocation.lat, this._userLocation.lon);
            if (nearest) {
                this._selectAndPlayStation(nearest);
            }
        } else {
            this._service.detectLocation((err, loc) => {
                if (loc) {
                    this._userLocation = loc;
                    this._globeView.rotateTo(loc.lat, loc.lon, true);
                    const nearest = this._service.findNearestStation(loc.lat, loc.lon);
                    if (nearest) {
                        this._selectAndPlayStation(nearest);
                    }
                }
            });
        }
    }

    _updatePlayerUI(state) {
        const current = this._player.currentStation;
        this._updateFavButtonState();

        switch (state) {
            case PlayState.PLAYING:
                this._playIcon.icon_name = 'media-playback-pause-symbolic';
                this._dotLabel.set_text('🟢');
                if (current) {
                    this._stationTitleLabel.set_text(current.name);
                    this._genreLabel.set_text(`${current.city ? current.city + ', ' : ''}${current.country || 'Live'} • ${current.tags || 'Live Radio'}`);
                    this._panelLabel.set_text(` ${current.name}`);
                    this._panelLabel.visible = true;
                }
                break;

            case PlayState.BUFFERING:
                this._playIcon.icon_name = 'media-playback-pause-symbolic';
                this._dotLabel.set_text('🟡');
                if (current) {
                    this._stationTitleLabel.set_text(current.name);
                    this._genreLabel.set_text(`Buffering ${current.name}...`);
                }
                break;

            case PlayState.PAUSED:
                this._playIcon.icon_name = 'media-playback-start-symbolic';
                this._dotLabel.set_text('⏸');
                this._genreLabel.set_text('Playback paused • Click play to resume');
                break;

            case PlayState.STOPPED:
                this._playIcon.icon_name = 'media-playback-start-symbolic';
                this._dotLabel.set_text('⚪');
                this._genreLabel.set_text('Drag to spin, wheel to zoom, click red dot to play');
                this._panelLabel.visible = false;
                break;

            case PlayState.ERROR:
                this._playIcon.icon_name = 'media-playback-start-symbolic';
                this._dotLabel.set_text('🔴');
                this._genreLabel.set_text('Stream temporarily unreachable, try another station');
                this._panelLabel.visible = false;
                break;
        }
    }

    destroy() {
        if (this._player) {
            this._player.destroy();
            this._player = null;
        }
        if (this._globeView) {
            this._globeView.destroy();
            this._globeView = null;
        }
        super.destroy();
    }
});
