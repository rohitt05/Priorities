// src/features/film-my-day/components/canvas/canvasUtils.ts

import { Dimensions } from 'react-native';
import { COLORS } from '@/theme/theme';

const { width: SW, height: SH } = Dimensions.get('window');

export const CANVAS_HALF_W = 600;
export const CANVAS_HALF_H = 800;
export const RENDER_WINDOW = SW * 2.5;

// ── Card shape ─────────────────────────────────────────────────
export interface CardPosition {
    x: number;
    y: number;
}

// ── Deco shape ─────────────────────────────────────────────────
export interface DecoItem {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    radius: number;
    /** circle mode: treat w as diameter */
    circle?: boolean;
}

const PALETTE_COLORS = Object.values(COLORS.PALETTE);

export function seededRand(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// ── Scatter film card positions ────────────────────────────────
export function buildCardLayout(
    count: number,
    cardW: number,
    cardH: number,
    layoutSeed = 77,
): CardPosition[] {
    const rand = seededRand(layoutSeed);
    const placed: { x: number; y: number; w: number; h: number }[] = [];

    for (let i = 0; i < count; i++) {
        let attempts = 0;
        let x = 0, y = 0;
        while (attempts < 100) {
            x = -CANVAS_HALF_W + rand() * CANVAS_HALF_W * 2;
            y = -CANVAS_HALF_H + rand() * CANVAS_HALF_H * 2;
            const tooClose = placed.some(p => {
                const dx = Math.abs(p.x - x);
                const dy = Math.abs(p.y - y);
                return dx < (cardW + p.w) * 0.6 && dy < (cardH + p.h) * 0.6;
            });
            if (!tooClose) break;
            attempts++;
        }
        placed.push({ x, y, w: cardW, h: cardH });
    }
    return placed.map(p => ({ x: p.x, y: p.y }));
}

// ── buildDecoRectLayout → now outputs circles of varied sizes ──
// Replaces the old rect layout entirely — all shapes are circles
export function buildDecoRectLayout(
    count = 35,
    seed = 55,
): DecoItem[] {
    const rand = seededRand(seed);
    const placed: DecoItem[] = [];

    // Three size bands: small (12–28), medium (35–70), large (80–140)
    const bands = [
        { rMin: 12, rMax: 28, weight: 0.50 },   // 50% small
        { rMin: 35, rMax: 70, weight: 0.35 },   // 35% medium
        { rMin: 80, rMax: 140, weight: 0.15 },  // 15% large
    ];

    for (let i = 0; i < count; i++) {
        // Pick band by weight
        const roll = rand();
        const band = roll < 0.50
            ? bands[0]
            : roll < 0.85
                ? bands[1]
                : bands[2];

        const r = band.rMin + rand() * (band.rMax - band.rMin);
        const color = PALETTE_COLORS[Math.floor(rand() * PALETTE_COLORS.length)];

        let attempts = 0;
        let x = 0, y = 0;
        while (attempts < 80) {
            x = -CANVAS_HALF_W + rand() * CANVAS_HALF_W * 2;
            y = -CANVAS_HALF_H + rand() * CANVAS_HALF_H * 2;
            const tooClose = placed.some(p => {
                const dx = p.x - x, dy = p.y - y;
                return Math.sqrt(dx * dx + dy * dy) < (p.w / 2 + r) * 1.1;
            });
            if (!tooClose) break;
            attempts++;
        }
        placed.push({ x, y, w: r * 2, h: r * 2, color, radius: r, circle: true });
    }
    return placed;
}

// ── Scatter deco circles (smaller accent dots) ─────────────────
export function buildDecoCircleLayout(
    count = 40,
    rMin = 8,
    rMax = 32,
    seed = 99,
): DecoItem[] {
    const rand = seededRand(seed);
    const placed: DecoItem[] = [];

    for (let i = 0; i < count; i++) {
        const r = rMin + rand() * (rMax - rMin);
        const color = PALETTE_COLORS[Math.floor(rand() * PALETTE_COLORS.length)];
        let attempts = 0;
        let x = 0, y = 0;
        while (attempts < 80) {
            x = -CANVAS_HALF_W + rand() * CANVAS_HALF_W * 2;
            y = -CANVAS_HALF_H + rand() * CANVAS_HALF_H * 2;
            const tooClose = placed.some(p => {
                const dx = p.x - x, dy = p.y - y;
                return Math.sqrt(dx * dx + dy * dy) < (p.w / 2 + r) * 1.05;
            });
            if (!tooClose) break;
            attempts++;
        }
        placed.push({ x, y, w: r * 2, h: r * 2, color, radius: r, circle: true });
    }
    return placed;
}

// ── Viewport visibility check ──────────────────────────────────
export function isInView(
    itemX: number, itemY: number,
    renderTx: number, renderTy: number, renderSc: number,
    screenW: number, screenH: number,
    margin = RENDER_WINDOW,
): boolean {
    const sx = screenW / 2 + renderTx + itemX * renderSc;
    const sy = screenH / 2 + renderTy + itemY * renderSc;
    return (
        sx > -margin && sx < screenW + margin &&
        sy > -margin && sy < screenH + margin
    );
}

// ── Color helpers ──────────────────────────────────────────────
export function hexRgb(hex: string) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgba(hex: string, a: number) {
    const { r, g, b } = hexRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
}