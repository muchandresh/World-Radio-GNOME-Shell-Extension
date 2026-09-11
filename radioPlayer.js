/* radioPlayer.js
 *
 * GStreamer audio engine for World Radio GNOME Shell Extension
 */

import GObject from 'gi://GObject';
import Gst from 'gi://Gst';

export const PlayState = {
    STOPPED: 'STOPPED',
    BUFFERING: 'BUFFERING',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    ERROR: 'ERROR',
};

export const RadioPlayer = GObject.registerClass({
    GTypeName: 'WorldRadioPlayer',
    Signals: {
        'state-changed': { param_types: [GObject.TYPE_STRING] },
        'meta-changed': { param_types: [GObject.TYPE_STRING] },
        'volume-changed': { param_types: [GObject.TYPE_FLOAT] },
    },
}, class RadioPlayer extends GObject.Object {
    _init() {
        super._init();
        this._pipeline = null;
        this._bus = null;
        this._watchId = null;
        this._currentStation = null;
        this._state = PlayState.STOPPED;
        this._volume = 0.8;
        this._isUserPaused = false;
        this._ensureGst();
    }

    _ensureGst() {
        if (!Gst.is_initialized()) {
            try {
                Gst.init(null);
            } catch (e) {
                console.error('[WorldRadio] Gst init error:', e);
            }
        }
    }

    get state() {
        return this._state;
    }

    get isPlaying() {
        return this._state === PlayState.PLAYING || this._state === PlayState.BUFFERING;
    }

    get currentStation() {
        return this._currentStation;
    }

    get volume() {
        if (this._pipeline) {
            try {
                return this._pipeline.get_property('volume');
            } catch (e) {
                return this._volume;
            }
        }
        return this._volume;
    }

    setVolume(vol) {
        this._volume = Math.max(0.0, Math.min(1.0, vol));
        if (this._pipeline) {
            try {
                this._pipeline.set_property('volume', this._volume);
            } catch (e) {
                console.error('[WorldRadio] Error setting volume:', e);
            }
        }
        this.emit('volume-changed', this._volume);
    }

    play(station) {
        if (!station || !station.url) {
            console.warn('[WorldRadio] Cannot play empty station URL');
            return false;
        }

        this.stop();
        this._currentStation = station;
        this._isUserPaused = false;
        this._setState(PlayState.BUFFERING);

        try {
            this._pipeline = Gst.ElementFactory.make('playbin', 'world-radio-player');
            if (!this._pipeline) {
                console.error('[WorldRadio] Failed to create GStreamer playbin');
                this._setState(PlayState.ERROR);
                return false;
            }

            this._pipeline.set_property('uri', station.url);
            this._pipeline.set_property('volume', this._volume);

            this._bus = this._pipeline.get_bus();
            this._bus.add_signal_watch();
            this._watchId = this._bus.connect('message', (bus, message) => {
                this._onBusMessage(bus, message);
            });

            const ret = this._pipeline.set_state(Gst.State.PLAYING);
            if (ret === Gst.StateChangeReturn.FAILURE) {
                console.error('[WorldRadio] Failed to start pipeline playback');
                this.stop();
                this._setState(PlayState.ERROR);
                return false;
            }

            return true;
        } catch (e) {
            console.error('[WorldRadio] Exception in play():', e.message);
            this.stop();
            this._setState(PlayState.ERROR);
            return false;
        }
    }

    togglePause() {
        if (!this._pipeline) {
            if (this._currentStation) {
                return this.play(this._currentStation);
            }
            return false;
        }

        if (this._state === PlayState.PLAYING || this._state === PlayState.BUFFERING) {
            this._isUserPaused = true;
            this._pipeline.set_state(Gst.State.PAUSED);
            this._setState(PlayState.PAUSED);
            return false;
        } else if (this._state === PlayState.PAUSED) {
            this._isUserPaused = false;
            this._pipeline.set_state(Gst.State.PLAYING);
            this._setState(PlayState.PLAYING);
            return true;
        }

        return false;
    }

    stop() {
        if (this._bus && this._watchId) {
            try {
                this._bus.disconnect(this._watchId);
                this._bus.remove_signal_watch();
            } catch (e) {}
            this._watchId = null;
            this._bus = null;
        }

        if (this._pipeline) {
            try {
                this._pipeline.set_state(Gst.State.NULL);
            } catch (e) {}
            this._pipeline = null;
        }

        this._isUserPaused = false;
        this._setState(PlayState.STOPPED);
    }

    _setState(newState) {
        if (this._state !== newState) {
            this._state = newState;
            this.emit('state-changed', this._state);
        }
    }

    _onBusMessage(bus, message) {
        if (!message) return;

        switch (message.type) {
            case Gst.MessageType.STATE_CHANGED: {
                if (message.src === this._pipeline) {
                    const [, newState, pendingState] = message.parse_state_changed();
                    if (newState === Gst.State.PLAYING) {
                        this._setState(PlayState.PLAYING);
                    } else if (newState === Gst.State.PAUSED) {
                        // Only report PAUSED if user intentionally paused it
                        if (this._isUserPaused) {
                            this._setState(PlayState.PAUSED);
                        } else if (pendingState === Gst.State.PLAYING) {
                            // Prerolling
                            this._setState(PlayState.BUFFERING);
                        }
                    }
                }
                break;
            }
            case Gst.MessageType.BUFFERING: {
                const percent = message.parse_buffering();
                if (percent < 100 && !this._isUserPaused) {
                    this._setState(PlayState.BUFFERING);
                } else if (this._state === PlayState.BUFFERING && !this._isUserPaused) {
                    this._setState(PlayState.PLAYING);
                }
                break;
            }
            case Gst.MessageType.TAG: {
                try {
                    const tagList = message.parse_tag();
                    let title = null;
                    const [, t] = tagList.get_string('title');
                    if (t) title = t;
                    if (title) {
                        this.emit('meta-changed', title);
                    }
                } catch (e) {}
                break;
            }
            case Gst.MessageType.ERROR: {
                const [err, dbg] = message.parse_error();
                console.error(`[WorldRadio] GStreamer Error: ${err.message} (${dbg})`);
                this.stop();
                this._setState(PlayState.ERROR);
                break;
            }
            case Gst.MessageType.EOS: {
                this.stop();
                break;
            }
        }
    }

    destroy() {
        this.stop();
        this._currentStation = null;
    }
});
