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

// ── Scatter deco rectangles ────────────────────────────────────
export function buildDecoRectLayout(
    count = 35,
    wMin = 40, wMax = 130,
    hMin = 55, hMax = 180,
    seed = 55,
): DecoItem[] {
    const rand = seededRand(seed);
    const placed: DecoItem[] = [];

    for (let i = 0; i < count; i++) {
        const w = wMin + rand() * (wMax - wMin);
        const h = hMin + rand() * (hMax - hMin);
        const color = PALETTE_COLORS[Math.floor(rand() * PALETTE_COLORS.length)];
        const radius = 8 + rand() * 16;
        let attempts = 0;
        let x = 0, y = 0;
        while (attempts < 80) {
            x = -CANVAS_HALF_W + rand() * CANVAS_HALF_W * 2;
            y = -CANVAS_HALF_H + rand() * CANVAS_HALF_H * 2;
            const tooClose = placed.some(p => {
                const dx = Math.abs(p.x - x);
                const dy = Math.abs(p.y - y);
                return dx < (p.w + w) * 0.7 && dy < (p.h + h) * 0.7;
            });
            if (!tooClose) break;
            attempts++;
        }
        placed.push({ x, y, w, h, color, radius });
    }
    return placed;
}

// ── Scatter deco circles ───────────────────────────────────────
export function buildDecoCircleLayout(
    count = 40,
    rMin = 15, rMax = 40,
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