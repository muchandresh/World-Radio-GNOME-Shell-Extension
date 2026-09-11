/* globeView.js
 *
 * Interactive 3D Orthographic Globe for World Radio GNOME Shell Extension
 * Features:
 * - 3D Orthographic projection with Cairo
 * - Continents & graticule grid
 * - Mouse drag to rotate (latitude & longitude)
 * - Deep zoom range (55px to 550px) with scroll wheel
 * - Real-time online radio station markers with dynamic scaling
 * - Station hover tooltips & pinpoint click-to-play
 * - Smooth camera transitions
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import cairo from 'cairo';
import {LAND_POLYGONS} from './landData.js';

export const GlobeView = GObject.registerClass({
    GTypeName: 'WorldRadioGlobeView',
    Signals: {
        'station-selected': { param_types: [GObject.TYPE_JSOBJECT] },
        'station-hovered': { param_types: [GObject.TYPE_JSOBJECT] },
    },
}, class GlobeView extends St.DrawingArea {
    _init(params = {}) {
        super._init({
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: true,
            ...params,
        });

        // Camera center orientation (degrees)
        this._lat0 = 20.0;
        this._lon0 = 0.0;

        // Expanded zoom depth range: from overview (55px) to deep zoom (550px)
        this._radius = 125.0;
        this._minRadius = 55.0;
        this._maxRadius = 550.0;

        // Interaction state
        this._isDragging = false;
        this._hasMoved = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._lastX = 0;
        this._lastY = 0;

        // Stations & Hover
        this._stations = [];
        this._hoveredStation = null;
        this._selectedStation = null;
        this._projectedStations = [];

        // Animation timers
        this._animTimerId = null;
        this._pulseTimerId = null;
        this._pulsePhase = 0;

        // Connect events
        this.connect('repaint', this._onRepaint.bind(this));
        this.connect('button-press-event', this._onButtonPress.bind(this));
        this.connect('motion-event', this._onMotion.bind(this));
        this.connect('button-release-event', this._onButtonRelease.bind(this));
        this.connect('scroll-event', this._onScroll.bind(this));
        this.connect('leave-event', this._onLeave.bind(this));
    }

    setStations(stations) {
        this._stations = stations || [];
        this.queue_repaint();
    }

    setSelectedStation(station) {
        this._selectedStation = station;
        if (station) {
            this._startPulsing();
        } else {
            this._stopPulsing();
        }
        this.queue_repaint();
    }

    rotateTo(targetLat, targetLon, animated = true) {
        targetLat = Math.max(-82, Math.min(82, targetLat));
        while (targetLon > 180) targetLon -= 360;
        while (targetLon < -180) targetLon += 360;

        if (!animated) {
            this._lat0 = targetLat;
            this._lon0 = targetLon;
            this.queue_repaint();
            return;
        }

        if (this._animTimerId) {
            GLib.source_remove(this._animTimerId);
            this._animTimerId = null;
        }

        let dLon = targetLon - this._lon0;
        if (dLon > 180) dLon -= 360;
        if (dLon < -180) dLon += 360;

        const startLat = this._lat0;
        const startLon = this._lon0;
        const totalSteps = 22;
        let step = 0;

        this._animTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 18, () => {
            step++;
            const t = step / totalSteps;
            const ease = 1 - Math.pow(1 - t, 3);

            this._lat0 = startLat + (targetLat - startLat) * ease;
            this._lon0 = startLon + dLon * ease;
            this.queue_repaint();

            if (step >= totalSteps) {
                this._lat0 = targetLat;
                this._lon0 = targetLon;
                this._animTimerId = null;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _startPulsing() {
        if (this._pulseTimerId) return;
        this._pulseTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 70, () => {
            this._pulsePhase = (this._pulsePhase + 0.15) % (2 * Math.PI);
            this.queue_repaint();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopPulsing() {
        if (this._pulseTimerId) {
            GLib.source_remove(this._pulseTimerId);
            this._pulseTimerId = null;
        }
    }

    _getLocalCoords(event) {
        const [stageX, stageY] = event.get_coords();
        const [ok, localX, localY] = this.transform_stage_point(stageX, stageY);
        return ok ? [localX, localY] : [stageX, stageY];
    }

    _onButtonPress(actor, event) {
        const button = event.get_button();
        if (button !== 1) return Clutter.EVENT_PROPAGATE;

        const [x, y] = this._getLocalCoords(event);
        this._isDragging = true;
        this._hasMoved = false;
        this._dragStartX = x;
        this._dragStartY = y;
        this._lastX = x;
        this._lastY = y;

        if (this._animTimerId) {
            GLib.source_remove(this._animTimerId);
            this._animTimerId = null;
        }

        return Clutter.EVENT_STOP;
    }

    _onMotion(actor, event) {
        const [x, y] = this._getLocalCoords(event);

        if (this._isDragging) {
            const dx = x - this._lastX;
            const dy = y - this._lastY;

            if (Math.abs(x - this._dragStartX) > 4 || Math.abs(y - this._dragStartY) > 4) {
                this._hasMoved = true;
            }

            const sensitivity = 160.0 / (this._radius * Math.PI);
            this._lon0 -= dx * sensitivity * 0.55;
            this._lat0 += dy * sensitivity * 0.55;

            this._lat0 = Math.max(-84, Math.min(84, this._lat0));

            while (this._lon0 > 180) this._lon0 -= 360;
            while (this._lon0 < -180) this._lon0 += 360;

            this._lastX = x;
            this._lastY = y;
            this.queue_repaint();
            return Clutter.EVENT_STOP;
        }

        // Hover detection with adaptive threshold
        let hovered = null;
        const hitThreshold = Math.max(14.0, this._radius * 0.06);
        let minDist = hitThreshold;

        for (const proj of this._projectedStations) {
            if (proj.z > 0.05) {
                const dist = Math.hypot(proj.x - x, proj.y - y);
                if (dist < minDist) {
                    minDist = dist;
                    hovered = proj.station;
                }
            }
        }

        if (hovered !== this._hoveredStation) {
            this._hoveredStation = hovered;
            this.emit('station-hovered', hovered);
            this.queue_repaint();
        }

        return Clutter.EVENT_STOP;
    }

    _onButtonRelease(actor, event) {
        const button = event.get_button();
        if (button !== 1) return Clutter.EVENT_PROPAGATE;

        const [x, y] = this._getLocalCoords(event);
        const wasDragging = this._isDragging;
        this._isDragging = false;

        if (!this._hasMoved && wasDragging) {
            // Recalculate exact closest station at click coordinates
            const hitThreshold = Math.max(18.0, this._radius * 0.08);
            let clickedStation = null;
            let minDist = hitThreshold;

            for (const proj of this._projectedStations) {
                if (proj.z > 0.02) {
                    const dist = Math.hypot(proj.x - x, proj.y - y);
                    if (dist < minDist) {
                        minDist = dist;
                        clickedStation = proj.station;
                    }
                }
            }

            if (clickedStation) {
                this.setSelectedStation(clickedStation);
                this.emit('station-selected', clickedStation);
                return Clutter.EVENT_STOP;
            }

            // Clicked on globe background: center towards clicked coordinate
            const [width, height] = this.get_surface_size();
            const cx = width / 2;
            const cy = height / 2;
            const dx = (x - cx) / this._radius;
            const dy = (y - cy) / this._radius;
            const rho2 = dx * dx + dy * dy;

            if (rho2 <= 1.0) {
                const rho = Math.sqrt(rho2);
                const c = Math.asin(rho);
                const sinC = Math.sin(c);
                const cosC = Math.cos(c);
                const lat0Rad = (this._lat0 * Math.PI) / 180;
                const lon0Rad = (this._lon0 * Math.PI) / 180;

                const clickedLatRad = Math.asin(cosC * Math.sin(lat0Rad) - (dy * sinC * Math.cos(lat0Rad)) / (rho || 1));
                const clickedLonRad = lon0Rad + Math.atan2(dx * sinC, rho * Math.cos(lat0Rad) * cosC + dy * Math.sin(lat0Rad) * sinC);

                const clickedLat = (clickedLatRad * 180) / Math.PI;
                const clickedLon = (clickedLonRad * 180) / Math.PI;

                this.rotateTo(clickedLat, clickedLon, true);
            }
        }

        return Clutter.EVENT_STOP;
    }

    _onScroll(actor, event) {
        let zoomIn = false;
        const dir = event.get_scroll_direction();

        if (dir === Clutter.ScrollDirection.UP) {
            zoomIn = true;
        } else if (dir === Clutter.ScrollDirection.DOWN) {
            zoomIn = false;
        } else if (dir === Clutter.ScrollDirection.SMOOTH) {
            const [, dy] = event.get_scroll_delta();
            if (dy < 0) zoomIn = true;
            else if (dy > 0) zoomIn = false;
            else return Clutter.EVENT_STOP;
        }

        if (zoomIn) {
            this._radius = Math.min(this._maxRadius, this._radius * 1.15);
        } else {
            this._radius = Math.max(this._minRadius, this._radius * 0.85);
        }

        this.queue_repaint();
        return Clutter.EVENT_STOP;
    }

    _onLeave(actor, event) {
        if (this._hoveredStation) {
            this._hoveredStation = null;
            this.queue_repaint();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _project(latDeg, lonDeg, cx, cy, R, sinLat0, cosLat0, lon0Rad) {
        const phi = (latDeg * Math.PI) / 180;
        const lam = (lonDeg * Math.PI) / 180;
        const dlam = lam - lon0Rad;

        const cosPhi = Math.cos(phi);
        const sinPhi = Math.sin(phi);
        const cosDlam = Math.cos(dlam);
        const sinDlam = Math.sin(dlam);

        const x = cosPhi * sinDlam;
        const y = -(cosLat0 * sinPhi - sinLat0 * cosPhi * cosDlam);
        const z = sinLat0 * sinPhi + cosLat0 * cosPhi * cosDlam;

        return [cx + R * x, cy + R * y, z];
    }

    _onRepaint(area) {
        const cr = this.get_context();
        const [width, height] = this.get_surface_size();

        if (width <= 0 || height <= 0) {
            cr.$dispose();
            return;
        }

        const cx = width / 2;
        const cy = height / 2;
        const R = this._radius;

        const lat0Rad = (this._lat0 * Math.PI) / 180;
        const lon0Rad = (this._lon0 * Math.PI) / 180;
        const sinLat0 = Math.sin(lat0Rad);
        const cosLat0 = Math.cos(lat0Rad);

        // 1. Soft atmospheric outer rim shadow
        cr.save();
        cr.arc(cx, cy, R + 2.5, 0, 2 * Math.PI);
        cr.setSourceRGBA(0.0, 0.0, 0.0, 0.06);
        cr.setLineWidth(4.0);
        cr.stroke();
        cr.restore();

        // 2. Base Sphere (radial 3D highlight)
        const grad = new cairo.RadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.05, cx, cy, R);
        grad.addColorStopRGB(0.0, 1.0, 1.0, 1.0);
        grad.addColorStopRGB(0.85, 0.94, 0.96, 0.98);
        grad.addColorStopRGB(1.0, 0.82, 0.85, 0.90);

        cr.save();
        cr.arc(cx, cy, R, 0, 2 * Math.PI);
        cr.setSource(grad);
        cr.fillPreserve();
        cr.clip();

        // 3. Graticules (Parallels & Meridians)
        cr.setSourceRGBA(0.68, 0.74, 0.82, 0.5);
        cr.setLineWidth(Math.max(0.6, Math.min(1.2, R * 0.007)));

        // Parallels (-75 to 75 deg)
        for (let pLat = -75; pLat <= 75; pLat += 15) {
            let first = true;
            for (let pLon = -180; pLon <= 180; pLon += 5) {
                const [px, py, pz] = this._project(pLat, pLon, cx, cy, R, sinLat0, cosLat0, lon0Rad);
                if (pz > -0.05) {
                    if (first) {
                        cr.moveTo(px, py);
                        first = false;
                    } else {
                        cr.lineTo(px, py);
                    }
                } else {
                    first = true;
                }
            }
            cr.stroke();
        }

        // Meridians (-180 to 180 deg)
        for (let pLon = -180; pLon < 180; pLon += 15) {
            let first = true;
            for (let pLat = -85; pLat <= 85; pLat += 5) {
                const [px, py, pz] = this._project(pLat, pLon, cx, cy, R, sinLat0, cosLat0, lon0Rad);
                if (pz > -0.05) {
                    if (first) {
                        cr.moveTo(px, py);
                        first = false;
                    } else {
                        cr.lineTo(px, py);
                    }
                } else {
                    first = true;
                }
            }
            cr.stroke();
        }

        // 4. Landmass Continents
        cr.setSourceRGB(0.86, 0.88, 0.91);
        for (const poly of LAND_POLYGONS) {
            const paths = [];
            let curr = [];
            for (const pt of poly) {
                const [px, py, pz] = this._project(pt[1], pt[0], cx, cy, R, sinLat0, cosLat0, lon0Rad);
                if (pz >= -0.02) {
                    curr.push([px, py]);
                } else {
                    if (curr.length > 0) {
                        paths.push(curr);
                        curr = [];
                    }
                }
            }
            if (curr.length > 0) paths.push(curr);

            for (const path of paths) {
                if (path.length < 2) continue;
                cr.moveTo(path[0][0], path[0][1]);
                for (let i = 1; i < path.length; i++) {
                    cr.lineTo(path[i][0], path[i][1]);
                }
                const dist = Math.hypot(path[0][0] - path[path.length - 1][0], path[0][1] - path[path.length - 1][1]);
                if (dist < 10.0 && path.length > 4) {
                    cr.closePath();
                    cr.fillPreserve();
                }
                cr.setSourceRGBA(0.55, 0.60, 0.66, 0.8);
                cr.setLineWidth(Math.max(0.7, Math.min(1.4, R * 0.008)));
                cr.stroke();
                cr.setSourceRGB(0.86, 0.88, 0.91);
            }
        }

        // 5. Radio Stations Projection & Markers
        this._projectedStations = [];
        let activeProj = null;
        let hoveredProj = null;

        const dotRadius = Math.max(2.2, Math.min(4.5, R * 0.022));
        const glowRadius = dotRadius * 1.8;

        for (const station of this._stations) {
            const [px, py, pz] = this._project(station.lat, station.lon, cx, cy, R, sinLat0, cosLat0, lon0Rad);
            const isSelected = this._selectedStation && this._selectedStation.name === station.name;
            const isHovered = this._hoveredStation && this._hoveredStation.name === station.name;

            const item = { station, x: px, y: py, z: pz, isSelected, isHovered };
            this._projectedStations.push(item);

            if (pz > 0.04) {
                if (isSelected) activeProj = item;
                if (isHovered) hoveredProj = item;

                // Standard red station marker
                cr.arc(px, py, glowRadius, 0, 2 * Math.PI);
                cr.setSourceRGBA(0.92, 0.20, 0.20, 0.25);
                cr.fill();

                cr.arc(px, py, dotRadius, 0, 2 * Math.PI);
                cr.setSourceRGB(0.92, 0.15, 0.15);
                cr.fill();
            }
        }

        // Active playing station pulsating halo (green / gold)
        if (activeProj && activeProj.z > 0.04) {
            const pulseR = dotRadius * 2.0 + Math.sin(this._pulsePhase) * 4.0;
            cr.arc(activeProj.x, activeProj.y, pulseR + 3.0, 0, 2 * Math.PI);
            cr.setSourceRGBA(0.20, 0.78, 0.35, 0.35);
            cr.fill();

            cr.arc(activeProj.x, activeProj.y, dotRadius * 1.5, 0, 2 * Math.PI);
            cr.setSourceRGB(0.18, 0.80, 0.35);
            cr.fill();
        }

        // Hovered station ring
        if (hoveredProj && hoveredProj.z > 0.04) {
            cr.arc(hoveredProj.x, hoveredProj.y, dotRadius * 2.4, 0, 2 * Math.PI);
            cr.setSourceRGBA(0.15, 0.15, 0.2, 0.25);
            cr.setLineWidth(1.6);
            cr.stroke();
        }

        cr.restore(); // Unclip from sphere

        // 6. Globe Boundary Stroke
        cr.arc(cx, cy, R, 0, 2 * Math.PI);
        cr.setSourceRGBA(0.35, 0.40, 0.48, 0.35);
        cr.setLineWidth(1.2);
        cr.stroke();

        // 7. Tooltip Rendering
        if (hoveredProj && hoveredProj.z > 0.04) {
            this._drawTooltip(cr, hoveredProj.x, hoveredProj.y, hoveredProj.station, width, height);
        }

        cr.$dispose();
    }

    _drawTooltip(cr, tx, ty, station, viewWidth, viewHeight) {
        const title = station.name || 'Radio Station';
        const subtitle = `${station.city ? station.city + ', ' : ''}${station.country || 'Live'} • ${station.tags ? station.tags.split(',')[0] : 'Radio'}`;
        const hint = '▶ Click to play';

        cr.save();
        cr.setFontSize(11);
        const titleExt = cr.textExtents(title);
        cr.setFontSize(9);
        const subExt = cr.textExtents(subtitle);

        const textW = Math.max(titleExt.width, subExt.width, 110);
        const padX = 10;
        const padY = 8;
        const bw = textW + padX * 2;
        const bh = 46;

        let bx = tx - bw / 2;
        let by = ty - bh - 10;
        let arrowDown = true;

        if (by < 10) {
            by = ty + 14;
            arrowDown = false;
        }
        bx = Math.max(8, Math.min(viewWidth - bw - 8, bx));

        const r = 7;
        cr.newSubPath();
        cr.arc(bx + bw - r, by + r, r, -Math.PI / 2, 0);
        cr.arc(bx + bw - r, by + bh - r, r, 0, Math.PI / 2);

        if (arrowDown) {
            const arrowX = Math.max(bx + 12, Math.min(bx + bw - 12, tx));
            cr.lineTo(arrowX + 5, by + bh);
            cr.lineTo(arrowX, by + bh + 6);
            cr.lineTo(arrowX - 5, by + bh);
        }

        cr.arc(bx + r, by + bh - r, r, Math.PI / 2, Math.PI);
        cr.arc(bx + r, by + r, r, Math.PI, (3 * Math.PI) / 2);

        if (!arrowDown) {
            const arrowX = Math.max(bx + 12, Math.min(bx + bw - 12, tx));
            cr.lineTo(arrowX - 5, by);
            cr.lineTo(arrowX, by - 6);
            cr.lineTo(arrowX + 5, by);
        }
        cr.closePath();

        cr.setSourceRGBA(0.11, 0.13, 0.17, 0.95);
        cr.fillPreserve();
        cr.setSourceRGBA(1.0, 1.0, 1.0, 0.15);
        cr.setLineWidth(1.0);
        cr.stroke();

        cr.setSourceRGB(1.0, 1.0, 1.0);
        cr.selectFontFace('Sans', cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD);
        cr.setFontSize(11);
        cr.moveTo(bx + padX, by + 16);
        cr.showText(title);

        cr.setSourceRGBA(0.82, 0.86, 0.92, 0.85);
        cr.selectFontFace('Sans', cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL);
        cr.setFontSize(9);
        cr.moveTo(bx + padX, by + 29);
        cr.showText(subtitle);

        cr.setSourceRGBA(0.35, 0.85, 0.45, 0.95);
        cr.setFontSize(8.5);
        cr.moveTo(bx + padX, by + 40);
        cr.showText(hint);

        cr.restore();
    }

    destroy() {
        if (this._animTimerId) {
            GLib.source_remove(this._animTimerId);
            this._animTimerId = null;
        }
        this._stopPulsing();
        super.destroy();
    }
});
