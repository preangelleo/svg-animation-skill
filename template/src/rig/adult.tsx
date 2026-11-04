// SPDX-License-Identifier: MIT
// Adult proportions, planted-foot IK, pose/face/walk helpers. Adapted from a team-authored adult rig.
import React from 'react';
import {easeInOut, lerp, clamp} from '../engine/anim';

export type Hand = 'fist' | 'open' | 'point' | 'three' | 'grip';
export type Expr = 'neutral' | 'stern' | 'doubt' | 'think' | 'laugh' | 'smug' | 'surprise' | 'eager' | 'wince' | 'worry';
export type Arm = {a: number; b: number}; // a: shoulder angle from straight down (+ = toward facing), b: elbow bend
export type Foot = {x: number; lift: number}; // ankle x relative to root, lift above ground
export type Pose = {
  x: number; y: number; scale: number; facing: 1 | -1;
  lean: number; hipDrop: number; hipX: number;
  headTilt: number; turn: number; look: number; lookY: number;
  armB: Arm; armF: Arm; handB: Hand; handF: Hand; wristB: number; wristF: number; armFBehind: boolean;
  footB: Foot; footF: Foot;
  expr: Expr; blink: number; talk: number; sway: number; bob: number;
};

export const basePose: Pose = {
  x: 960, y: 900, scale: 1, facing: 1,
  lean: 0, hipDrop: 6, hipX: 0,
  headTilt: 0, turn: 0, look: 0, lookY: 0,
  armB: {a: 6, b: 10}, armF: {a: 4, b: 12}, handB: 'fist', handF: 'fist', wristB: 0, wristF: 0, armFBehind: false,
  footB: {x: -26, lift: 0}, footF: {x: 30, lift: 0},
  expr: 'neutral', blink: 0, talk: 0, sway: 0, bob: 0,
};

type Key = {f: number; p: Partial<Pose>; ease?: (t: number) => number};
const mixA = (a: Arm, b: Arm, t: number): Arm => ({a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t)});
const mixF = (a: Foot, b: Foot, t: number): Foot => ({x: lerp(a.x, b.x, t), lift: lerp(a.lift, b.lift, t)});

/** Key poses carried forward and eased; discrete parts (hands, face, facing) switch at the later key's half. */
export const poseAt = (f: number, keys: Key[], from: Pose = basePose): Pose => {
  const full: {f: number; p: Pose; ease?: (t: number) => number}[] = [];
  let cur = from;
  for (const k of keys) { cur = {...cur, ...k.p}; full.push({f: k.f, p: cur, ease: k.ease}); }
  if (!full.length) return from;
  if (f <= full[0].f) return full[0].p;
  for (let i = 0; i < full.length - 1; i++) {
    const A = full[i].p, B = full[i + 1].p;
    if (f <= full[i + 1].f) {
      const t = (full[i + 1].ease ?? easeInOut)((f - full[i].f) / Math.max(1e-6, full[i + 1].f - full[i].f));
      const d = t < 0.5 ? A : B;
      return {
        x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), scale: lerp(A.scale, B.scale, t), facing: d.facing,
        lean: lerp(A.lean, B.lean, t), hipDrop: lerp(A.hipDrop, B.hipDrop, t), hipX: lerp(A.hipX, B.hipX, t),
        headTilt: lerp(A.headTilt, B.headTilt, t), turn: lerp(A.turn, B.turn, t), look: lerp(A.look, B.look, t), lookY: lerp(A.lookY, B.lookY, t),
        armB: mixA(A.armB, B.armB, t), armF: mixA(A.armF, B.armF, t), handB: d.handB, handF: d.handF,
        wristB: lerp(A.wristB, B.wristB, t), wristF: lerp(A.wristF, B.wristF, t), armFBehind: d.armFBehind,
        footB: mixF(A.footB, B.footB, t), footF: mixF(A.footF, B.footF, t),
        expr: A.expr, blink: lerp(A.blink, B.blink, t), talk: lerp(A.talk, B.talk, t), sway: lerp(A.sway, B.sway, t), bob: lerp(A.bob, B.bob, t),
      };
    }
  }
  return full[full.length - 1].p;
};

/** Expression swaps pass through a two-frame blink; plus sparse deterministic idle blinks. */
export const faceAt = (f: number, keys: [number, Expr][], seed = 0): {expr: Expr; blink: number} => {
  let expr: Expr = keys[0]?.[1] ?? 'neutral';
  let blink = 0;
  for (let i = 0; i < keys.length; i++) {
    const [k, e] = keys[i];
    if (f >= k) expr = e;
    if (i > 0 && f >= k - 1 && f < k + 1) blink = 1;
  }
  const period = 97 + (seed % 5) * 11;
  const ph = (f + seed * 37) % period;
  if (ph >= 0 && ph < 3) blink = Math.max(blink, ph === 1 ? 1 : 0.6);
  return {expr, blink};
};

/** Mouth openness driven by the user-supplied alignment character clock inside a speaking window (seconds, local). */
export type FaChar = {c: string; s: number; e: number};
export const talkAt = (sec: number, chars: FaChar[], a: number, b: number) => {
  if (sec < a || sec > b) return 0;
  const c = chars.find((x) => sec >= x.s && sec < x.e && x.s >= a - 0.05 && x.e <= b + 0.05 && x.c.trim() && !'，。、？！'.includes(x.c));
  if (!c) return 0;
  return 0.25 + 0.75 * Math.sin(Math.PI * clamp((sec - c.s) / Math.max(0.05, c.e - c.s)));
};

/** Walk: planted stance foot (no sliding), returns root x and foot keys for a given distance travelled. */
export const walkAt = (dist: number, stride = 70, lift = 22) => {
  const cyc = dist / (2 * stride); // one full cycle per two strides
  const foot = (off: number): Foot => {
    const p = (((cyc + off) % 1) + 1) % 1;
    if (p < 0.5) return {x: stride / 2 - (p / 0.5) * stride, lift: 0};
    const s = (p - 0.5) / 0.5;
    return {x: -stride / 2 + s * stride, lift: Math.sin(Math.PI * s) * lift};
  };
  const ph = (((cyc * 2) % 1) + 1) % 1;
  return {footF: foot(0), footB: foot(0.5), hipDrop: 6 + Math.abs(Math.cos(Math.PI * ph)) * 5};
};

// ---------------- geometry ----------------
const R = Math.PI / 180;
type P = {x: number; y: number};
const THIGH = 108, SHIN = 102, UPPER = 80, FORE = 74;
const HIP_H = 222; // ground (y=0) to hip when standing straight
const add = (a: P, b: P) => ({x: a.x + b.x, y: a.y + b.y});
const dirA = (deg: number): P => ({x: Math.sin(deg * R), y: Math.cos(deg * R)});
const svgAng = (v: P) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

const legIK = (hip: P, ankle: P): {knee: P; ankle: P} => {
  let dx = ankle.x - hip.x, dy = ankle.y - hip.y;
  let d = Math.max(0.0001, Math.hypot(dx, dy));
  const max = THIGH + SHIN - 0.5;
  if (d > max) { ankle = {x: hip.x + (dx / d) * max, y: hip.y + (dy / d) * max}; dx = ankle.x - hip.x; dy = ankle.y - hip.y; d = max; }
  const a = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d), -1, 1));
  const base = Math.atan2(dy, dx);
  const k1 = {x: hip.x + Math.cos(base - a) * THIGH, y: hip.y + Math.sin(base - a) * THIGH};
  const k2 = {x: hip.x + Math.cos(base + a) * THIGH, y: hip.y + Math.sin(base + a) * THIGH};
  return {knee: k1.x > k2.x ? k1 : k2, ankle}; // knees bend toward the facing side
};
const armFK = (sh: P, arm: Arm) => {
  const el = add(sh, {x: dirA(arm.a).x * UPPER, y: dirA(arm.a).y * UPPER});
  const fd = dirA(arm.a + arm.b);
  const wr = add(el, {x: fd.x * FORE, y: fd.y * FORE});
  return {sh, el, wr, ang: svgAng(fd)};
};

// ---------------- looks ----------------
export type Look = {
  skin: string; skinShade: string; ink: string; hair: string;
  robe: string; robeShade: string; trim: string; trouser: string; wrap: string; shoe: string;
  armour?: {plate: string; hi: string; rivet: string; cord: string};
  sash: string; bracer: string; build: number; hem: number;
  face: 'square' | 'oval' | 'long'; beard: 'full' | 'mustache' | 'long' | 'none';
  hat: 'none' | 'knot' | 'helmet' | 'cap' | 'guan'; browW: number;
};

// ---------------- parts ----------------
const Limb: React.FC<{pts: P[]; w: number; fill: string; ink: string; ow?: number}> = ({pts, w, fill, ink, ow = 8}) => {
  const d = 'M ' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
  return <g><path d={d} stroke={ink} strokeWidth={w + ow} fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={d} stroke={fill} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>;
};

const HandShape: React.FC<{at: P; ang: number; kind: Hand; L: Look; s?: number}> = ({at, ang, kind, L, s = 1}) => {
  const k = {fill: L.skin, stroke: L.ink, strokeWidth: 4};
  return <g transform={`translate(${at.x} ${at.y}) rotate(${ang}) scale(${s})`}>
    {kind === 'open' ? <g>
      <path d="M 4 -14 L 36 -14 Q 46 -12 46 -5 Q 46 0 40 0 Q 47 4 44 10 Q 40 14 30 13 L 6 14 Q -4 10 -2 0 Q -3 -12 4 -14 Z" {...k} />
      <path d="M 26 -6 L 40 -6 M 26 4 L 40 5" stroke={L.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M 12 -13 Q 18 -26 28 -24 Q 32 -20 24 -12" {...k} />
    </g> : kind === 'three' ? <g>
      <path d="M 18 -16 L 46 -16 M 18 -6 L 48 -6 M 18 4 L 45 4" stroke={L.ink} strokeWidth={12} strokeLinecap="round" />
      <path d="M 18 -16 L 46 -16 M 18 -6 L 48 -6 M 18 4 L 45 4" stroke={L.skin} strokeWidth={5.5} strokeLinecap="round" />
      <ellipse cx={14} cy={0} rx={17} ry={16} {...k} />
      <path d="M 10 10 Q 22 18 28 10" stroke={L.ink} strokeWidth={3} fill="none" />
    </g> : <g>
      {kind === 'point' ? <g><path d="M 20 -8 L 48 -9" stroke={L.ink} strokeWidth={13} strokeLinecap="round" /><path d="M 20 -8 L 48 -9" stroke={L.skin} strokeWidth={6} strokeLinecap="round" /></g> : null}
      <ellipse cx={15} cy={0} rx={18} ry={16} {...k} />
      <path d={kind === 'point' ? 'M 24 2 Q 30 6 26 11 M 16 6 Q 22 12 16 15' : 'M 26 -8 Q 33 -4 28 2 M 26 2 Q 33 6 27 11 M 16 8 Q 22 14 15 16'} stroke={L.ink} strokeWidth={2.5} fill="none" />
      <path d="M 6 -12 Q 18 -18 26 -10" stroke={L.ink} strokeWidth={3} fill="none" />
    </g>}
  </g>;
};

const Shoe: React.FC<{at: P; L: Look; tilt: number}> = ({at, L, tilt}) => <g transform={`translate(${at.x} ${at.y}) rotate(${tilt})`}>
  <path d="M -16 -16 Q -20 6 -12 14 L 38 14 Q 46 12 44 4 Q 40 -4 26 -6 L 12 -16 Z" fill={L.shoe} stroke={L.ink} strokeWidth={4} strokeLinejoin="round" />
  <path d="M -12 10 L 40 10" stroke="#4a463f" strokeWidth={2} />
</g>;

const LegDraw: React.FC<{hip: P; knee: P; ankle: P; L: Look; lift: number}> = ({hip, knee, ankle, L, lift}) => {
  const sd = {x: ankle.x - knee.x, y: ankle.y - knee.y};
  const n = Math.hypot(sd.x, sd.y) || 1;
  const wraps = [0.18, 0.36, 0.54, 0.72].map((u) => ({x: knee.x + sd.x * u, y: knee.y + sd.y * u}));
  const px = -sd.y / n, py = sd.x / n;
  return <g>
    <Limb pts={[hip, knee]} w={50} fill={L.trouser} ink={L.ink} />
    <Limb pts={[knee, ankle]} w={30} fill={L.wrap} ink={L.ink} />
    <ellipse cx={knee.x} cy={knee.y} rx={26} ry={24} fill={L.trouser} />
    {wraps.map((w, i) => <path key={i} d={`M ${w.x - px * 14} ${w.y - py * 14 - 3} L ${w.x + px * 14} ${w.y + py * 14 + 3}`} stroke={L.ink} strokeWidth={2.2} opacity={0.55} />)}
    <Shoe at={ankle} L={L} tilt={lift > 1 ? 10 : 0} />
  </g>;
};

const Lamellar: React.FC<{id: string; d: string; A: NonNullable<Look['armour']>; ink: string; x0: number; x1: number; y0: number; y1: number; row?: number; col?: number}> = ({id, d, A, ink, x0, x1, y0, y1, row = 17, col = 15}) => {
  const rows: number[] = []; for (let y = y0 + row; y < y1; y += row) rows.push(y);
  const cells: P[] = [];
  rows.forEach((y, i) => { for (let x = x0 + ((i % 2) * col) / 2; x < x1; x += col) cells.push({x, y}); });
  return <g>
    <clipPath id={id}><path d={d} /></clipPath>
    <path d={d} fill={A.plate} />
    <g clipPath={`url(#${id})`}>
      {rows.map((y, i) => <g key={i}><path d={`M ${x0} ${y} H ${x1}`} stroke={ink} strokeWidth={2.4} /><path d={`M ${x0} ${y - row + 3} H ${x1}`} stroke={A.hi} strokeWidth={2} opacity={0.7} /></g>)}
      {cells.map((c, i) => <path key={i} d={`M ${c.x} ${c.y - row + 1} V ${c.y - 2}`} stroke={ink} strokeWidth={1.6} opacity={0.75} />)}
      {cells.filter((_, i) => i % 2 === 0).map((c, i) => <circle key={'r' + i} cx={c.x + col / 2} cy={c.y - row / 2} r={1.6} fill={A.rivet} />)}
    </g>
    <path d={d} fill="none" stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
  </g>;
};

// ---------------- head ----------------
const Head: React.FC<{p: Pose; L: Look; id: string}> = ({p, L, id}) => {
  const ink = L.ink;
  const tx = p.turn * 6;
  const face = L.face === 'square' ? 'M -32 -24 Q -32 -48 2 -48 Q 38 -48 41 -22 L 44 4 Q 46 30 34 44 Q 20 54 0 52 Q -24 48 -30 26 Z'
    : L.face === 'oval' ? 'M -30 -24 Q -30 -46 2 -46 Q 34 -46 37 -20 L 40 6 Q 40 30 27 42 Q 13 49 -1 47 Q -23 43 -28 22 Z'
    : 'M -30 -26 Q -30 -50 2 -50 Q 34 -50 37 -24 L 40 8 Q 41 36 27 48 Q 12 56 -2 53 Q -24 48 -28 24 Z';
  const ex = p.expr;
  const laugh = ex === 'laugh';
  const open = ({neutral: 0.9, stern: 0.65, doubt: 0.8, think: 0.55, laugh: 0, smug: 0.45, surprise: 1.15, eager: 1, wince: 0, worry: 0.85} as Record<Expr, number>)[ex] * (1 - p.blink);
  // brows: [innerDy, outerDy] relative; negative = up
  const brow = ({neutral: [0, 0], stern: [6, -4], doubt: [-6, -8], think: [5, -1], laugh: [-6, -4], smug: [0, -5], surprise: [-10, -9], eager: [-5, -4], wince: [7, 0], worry: [-8, 2]} as Record<Expr, number[]>)[ex];
  const farBrowLift = ex === 'doubt' ? 5 : 0;
  const eyes: {cx: number; w: number; far: boolean}[] = [{cx: 7 + tx, w: 7, far: true}, {cx: 29 + tx, w: 8.5, far: false}];
  const eyeY = -6;
  const lx = p.look * 2.6, ly = p.lookY * 2;
  const mouthX = 27 + tx, mouthY = 27;
  const talk = p.talk;
  let mouth: React.ReactNode;
  if (laugh) {
    const h = 15 + talk * 6;
    mouth = <g><path d={`M ${mouthX - 16} ${mouthY - 4} Q ${mouthX} ${mouthY - 7} ${mouthX + 15} ${mouthY - 5} Q ${mouthX + 12} ${mouthY + h} ${mouthX - 2} ${mouthY + h} Q ${mouthX - 14} ${mouthY + h - 2} ${mouthX - 16} ${mouthY - 4} Z`} fill="#5a2a20" stroke={ink} strokeWidth={3.5} />
      <path d={`M ${mouthX - 13} ${mouthY - 3} Q ${mouthX} ${mouthY - 5} ${mouthX + 13} ${mouthY - 4} L ${mouthX + 12} ${mouthY + 2} Q ${mouthX} ${mouthY + 1} ${mouthX - 12} ${mouthY + 2} Z`} fill="#f4ecdc" />
      <ellipse cx={mouthX - 1} cy={mouthY + h - 5} rx={7} ry={3.5} fill="#b5523e" /></g>;
  } else if (talk > 0.08 || ex === 'surprise') {
    const h = ex === 'surprise' ? 10 : 3 + talk * 10;
    mouth = <g><ellipse cx={mouthX} cy={mouthY + h / 2 - 1} rx={ex === 'surprise' ? 7 : 9 - talk * 2} ry={h / 2 + 1} fill="#5a2a20" stroke={ink} strokeWidth={3.2} />
      {h > 7 ? <path d={`M ${mouthX - 6} ${mouthY - 0.5} Q ${mouthX} ${mouthY - 2} ${mouthX + 6} ${mouthY - 0.5}`} stroke="#f4ecdc" strokeWidth={3} fill="none" /> : null}</g>;
  } else {
    const shapes: Record<string, string> = {
      neutral: `M ${mouthX - 9} ${mouthY} Q ${mouthX} ${mouthY + 2} ${mouthX + 9} ${mouthY}`,
      stern: `M ${mouthX - 10} ${mouthY + 3} Q ${mouthX} ${mouthY - 3} ${mouthX + 10} ${mouthY + 3}`,
      doubt: `M ${mouthX - 9} ${mouthY + 2} L ${mouthX + 3} ${mouthY} Q ${mouthX + 8} ${mouthY - 1} ${mouthX + 10} ${mouthY - 4}`,
      think: `M ${mouthX - 6} ${mouthY + 1} H ${mouthX + 6}`,
      smug: `M ${mouthX - 10} ${mouthY} Q ${mouthX + 2} ${mouthY + 6} ${mouthX + 11} ${mouthY - 5}`,
      eager: `M ${mouthX - 10} ${mouthY - 1} Q ${mouthX} ${mouthY + 8} ${mouthX + 11} ${mouthY - 2}`,
      wince: `M ${mouthX - 10} ${mouthY + 1} L ${mouthX - 5} ${mouthY - 2} L ${mouthX} ${mouthY + 2} L ${mouthX + 5} ${mouthY - 2} L ${mouthX + 10} ${mouthY + 1}`,
      worry: `M ${mouthX - 9} ${mouthY + 2} Q ${mouthX - 4} ${mouthY - 2} ${mouthX} ${mouthY + 1} Q ${mouthX + 5} ${mouthY + 4} ${mouthX + 9} ${mouthY}`,
    };
    mouth = <path d={shapes[ex] ?? shapes.neutral} stroke={ink} strokeWidth={3.6} fill="none" strokeLinecap="round" />;
  }
  return <g>
    {/* topknot / hat behind the skull */}
    {L.hat === 'knot' ? <g><circle cx={-6} cy={-60} r={15} fill={L.hair} stroke={ink} strokeWidth={4} /><path d="M -18 -50 L 6 -52 L 6 -45 L -18 -43 Z" fill={L.robe} stroke={ink} strokeWidth={2.5} /><path d="M -4 -74 Q 8 -84 20 -78" stroke={ink} strokeWidth={2.5} fill="none" /></g> : null}
    {L.hat === 'cap' ? <g><path d="M -16 -58 Q -6 -76 10 -62 Q 4 -50 -12 -50 Z" fill="#4a4036" stroke={ink} strokeWidth={4} /><path d="M -14 -52 Q -34 -46 -40 -30 M -12 -50 Q -28 -40 -30 -26" stroke="#4a4036" strokeWidth={5} fill="none" strokeLinecap="round" /></g> : null}
    {L.hat === 'guan' ? <g><path d="M -14 -50 L -10 -72 L 14 -74 L 16 -50 Z" fill="#26231f" stroke={ink} strokeWidth={4} /><path d="M -22 -70 L 26 -76" stroke={ink} strokeWidth={4} /><path d="M -10 -46 Q -30 -20 -24 10" stroke={ink} strokeWidth={2} fill="none" /></g> : null}
    <path d={face} fill={L.skin} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
    {/* turned-away cheek shading for 3/4 volume */}
    <path d={L.face === 'square' ? 'M -30 -10 Q -26 26 -6 44 Q -24 46 -30 26 Z' : 'M -28 -8 Q -24 24 -6 42 Q -22 42 -27 22 Z'} fill={L.skinShade} opacity={0.6} />
    {/* hair cap */}
    {L.hat !== 'helmet' ? <path d={L.hat === 'cap' ? 'M -31 2 Q -38 -40 -4 -50 Q 32 -54 39 -24 Q 26 -36 6 -36 Q -10 -34 -16 -22 Q -22 -10 -24 2 Z' : 'M -32 4 Q -40 -42 -4 -51 Q 34 -55 42 -22 L 40 -16 Q 30 -32 8 -34 Q -8 -34 -14 -24 Q -20 -12 -24 4 Z'} fill={L.hair} stroke={ink} strokeWidth={3} strokeLinejoin="round" /> : null}
    {L.hat === 'helmet' ? <g>
      <path d="M -38 -6 Q -42 -62 2 -64 Q 44 -64 44 -28 L 36 -28 Q 34 -48 4 -50 Q -20 -48 -24 -6 Z" fill="#4a453e" stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
      <path d="M -38 -8 L -40 22 Q -32 32 -24 26 L -24 -6 Z" fill="#4a453e" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      <path d="M -34 -36 Q 2 -46 40 -32" stroke="#6b6458" strokeWidth={3} fill="none" />
      <path d="M 2 -60 L 2 -72" stroke={ink} strokeWidth={4} /><path d="M 2 -70 Q -10 -86 -18 -78 Q -8 -74 2 -70 Z" fill="#a5492c" stroke={ink} strokeWidth={2.5} />
      {[-30, -14, 4, 22].map((x) => <circle key={x} cx={x} cy={-45 + Math.abs(x - 4) * 0.25} r={2} fill="#c9a070" />)}
    </g> : null}
    {/* ear */}
    {L.hat !== 'helmet' ? <g><ellipse cx={-20} cy={2} rx={8} ry={11} fill={L.skin} stroke={ink} strokeWidth={3.5} /><path d="M -21 -3 Q -16 2 -21 7" stroke={ink} strokeWidth={2} fill="none" /></g> : null}
    {/* beard */}
    {L.beard === 'full' ? <path d={`M -24 4 Q -26 30 -8 48 Q 10 58 30 50 Q 44 42 44 22 Q 40 30 ${mouthX + 10} ${mouthY + 10} Q ${mouthX} ${mouthY + 14} ${mouthX - 12} ${mouthY + 8} Q -6 26 -12 8 Q -16 2 -24 4 Z`} fill={L.hair} stroke={ink} strokeWidth={3} strokeLinejoin="round" /> : null}
    {L.beard === 'long' ? <path d={`M ${mouthX - 10} ${mouthY + 8} Q ${mouthX} ${mouthY + 14} ${mouthX + 10} ${mouthY + 8} Q ${mouthX + 6 + p.sway * 0.3} ${mouthY + 50} ${mouthX - 1 + p.sway * 0.6} ${mouthY + 74} Q ${mouthX - 7} ${mouthY + 44} ${mouthX - 10} ${mouthY + 8} Z`} fill="#8d877c" stroke={ink} strokeWidth={3} /> : null}
    {/* nose */}
    <path d={`M ${40 + tx * 0.3} -10 Q ${54 + tx * 0.3} 8 ${43 + tx * 0.3} 15`} fill={L.skin} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
    {/* eyes */}
    {eyes.map((e, i) => {
      const cy = eyeY + ly * 0;
      if (laugh || ex === 'wince') {
        return <path key={i} d={laugh ? `M ${e.cx - e.w} ${cy + 2} Q ${e.cx} ${cy - 8} ${e.cx + e.w} ${cy + 2}` : `M ${e.cx - e.w} ${cy - 4} L ${e.cx + e.w * 0.6} ${cy} L ${e.cx - e.w} ${cy + 4}`} stroke={ink} strokeWidth={4} fill="none" strokeLinecap="round" />;
      }
      const h = Math.max(0.6, 6.2 * open);
      if (h < 1.2) return <path key={i} d={`M ${e.cx - e.w} ${cy} Q ${e.cx} ${cy + 2} ${e.cx + e.w} ${cy}`} stroke={ink} strokeWidth={3.6} fill="none" strokeLinecap="round" />;
      return <g key={i}>
        <path d={`M ${e.cx - e.w} ${cy} Q ${e.cx} ${cy - h * 1.3} ${e.cx + e.w} ${cy} Q ${e.cx} ${cy + h} ${e.cx - e.w} ${cy} Z`} fill="#f6f1e6" stroke={ink} strokeWidth={2.2} />
        <circle cx={e.cx + 1.5 + lx} cy={cy - 0.5 + ly} r={Math.min(4.3, h * 0.75)} fill={ink} />
        <path d={`M ${e.cx - e.w - 1} ${cy + 0.5} Q ${e.cx} ${cy - h * 1.35} ${e.cx + e.w + 1} ${cy - 0.5}`} stroke={ink} strokeWidth={3.6} fill="none" strokeLinecap="round" />
      </g>;
    })}
    {/* brows */}
    {eyes.map((e, i) => {
      const inner = e.far ? e.cx + e.w * 0.55 : e.cx - e.w * 0.5;
      const outer = e.far ? e.cx - e.w - 2 : e.cx + e.w + 3;
      const lift = e.far ? farBrowLift : 0;
      const by = -19;
      return <path key={'b' + i} d={`M ${inner} ${by + brow[0] - lift} L ${outer} ${by + brow[1] - lift}`} stroke={L.beard === 'long' ? '#6b665d' : L.hair} strokeWidth={L.browW} strokeLinecap="round" />;
    })}
    {/* mustache over the mouth */}
    {L.beard === 'full' || L.beard === 'mustache' || L.beard === 'long' ? <path d={`M ${mouthX - 14} ${mouthY - 2 + (laugh ? -3 : 0)} Q ${mouthX - 6} ${mouthY - 10} ${mouthX} ${mouthY - 7} Q ${mouthX + 7} ${mouthY - 10} ${mouthX + 15} ${mouthY - 3 + (laugh ? -3 : 0)} Q ${mouthX + 4} ${mouthY - 4} ${mouthX} ${mouthY - 5} Q ${mouthX - 6} ${mouthY - 4} ${mouthX - 14} ${mouthY - 2 + (laugh ? -3 : 0)} Z`} fill={L.beard === 'long' ? '#8d877c' : L.hair} stroke={ink} strokeWidth={2.5} /> : null}
    {mouth}
    {L.beard === 'none' ? <path d={`M ${mouthX - 4} ${mouthY + 12} Q ${mouthX + 2} ${mouthY + 15} ${mouthX + 7} ${mouthY + 12}`} stroke={L.skinShade} strokeWidth={2.5} fill="none" /> : null}
    {laugh ? <g opacity={0.5}><ellipse cx={34 + tx} cy={10} rx={7} ry={4} fill="#d97757" /></g> : null}
  </g>;
};

// ---------------- actor ----------------
export type Prop = 'whip' | 'whipSash' | 'banner' | 'none';
export const Actor: React.FC<{pose: Pose; look: Look; id: string; prop?: Prop; propLag?: number; t?: number; shadow?: boolean}> = ({pose: p, look: L, id, prop = 'none', propLag = 0, t = 0, shadow = true}) => {
  const ink = L.ink;
  const hip: P = {x: p.hipX, y: -HIP_H + p.hipDrop + p.bob};
  const hB = add(hip, {x: -14 * L.build, y: 2}), hF = add(hip, {x: 16 * L.build, y: 4});
  const lB = legIK(hB, {x: p.footB.x, y: -14 - p.footB.lift});
  const lF = legIK(hF, {x: p.footF.x, y: -14 - p.footF.lift});
  // upper body in hip-relative coordinates, rotated by lean
  const shB: P = {x: -32 * L.build, y: -150}, shF: P = {x: 36 * L.build, y: -148};
  const aB = armFK(shB, p.armB), aF = armFK(shF, p.armF);
  const up = `translate(${hip.x} ${hip.y}) rotate(${p.lean})`;
  const w = L.build;
  const torso = `M ${-44 * w} -162 Q ${2} ${-170} ${46 * w} -164 Q ${58 * w} -130 ${54 * w} -60 L ${48 * w} -22 L ${-42 * w} -22 Q ${-52 * w} -70 ${-50 * w} -130 Z`;
  // robe skirt follows the knees
  const kMinX = Math.min(lB.knee.x, lF.knee.x) - 34, kMaxX = Math.max(lB.knee.x, lF.knee.x) + 34;
  const hemY = Math.max(lB.knee.y, lF.knee.y) + L.hem;
  const wl = add(hip, {x: -48 * w, y: -30}), wr = add(hip, {x: 52 * w, y: -30});
  const skirt = `M ${wl.x} ${wl.y} L ${wr.x} ${wr.y} Q ${kMaxX + 6} ${(wr.y + hemY) / 2} ${kMaxX} ${hemY} Q ${(kMinX + kMaxX) / 2} ${hemY + 10} ${kMinX} ${hemY - 4} Q ${kMinX - 4} ${(wl.y + hemY) / 2} ${wl.x} ${wl.y} Z`;
  const tasY = wl.y + (hemY - wl.y) * 0.62;
  const tassets = `M ${wl.x - 2} ${wl.y} L ${wr.x + 2} ${wr.y} L ${kMaxX - 6} ${tasY} Q ${(kMinX + kMaxX) / 2} ${tasY + 8} ${kMinX + 4} ${tasY - 2} Z`;
  const ArmDraw = (a: ReturnType<typeof armFK>, hand: Hand, wrist: number, front: boolean) => <g>
    <Limb pts={[a.sh, a.el]} w={38} fill={L.robe} ink={ink} />
    <Limb pts={[a.el, a.wr]} w={28} fill={L.bracer} ink={ink} />
    {[0.25, 0.5, 0.75].map((u) => { const q = {x: a.el.x + (a.wr.x - a.el.x) * u, y: a.el.y + (a.wr.y - a.el.y) * u}; const r = (a.ang + 90) * R; return <path key={u} d={`M ${q.x - Math.cos(r) * 12} ${q.y - Math.sin(r) * 12} L ${q.x + Math.cos(r) * 12} ${q.y + Math.sin(r) * 12}`} stroke={ink} strokeWidth={2} opacity={0.5} />; })}
    <ellipse cx={a.el.x} cy={a.el.y} rx={20} ry={20} fill={L.robe} />
    <HandShape at={a.wr} ang={a.ang + wrist} kind={hand} L={L} />
    {L.armour ? <g transform={`translate(${a.sh.x} ${a.sh.y}) rotate(${-(front ? p.armF.a : p.armB.a) * 0.45})`}>
      <Lamellar id={`${id}-pd${front ? 'f' : 'b'}`} d="M -24 -8 Q 2 -20 28 -8 L 30 34 Q 4 44 -24 36 Z" A={L.armour} ink={ink} x0={-30} x1={34} y0={-26} y1={44} row={13} col={12} />
    </g> : null}
  </g>;
  // whip in the front hand: lash trails by angular velocity (propLag)
  let propEl: React.ReactNode = null;
  if (prop === 'whip') {
    const d = (aF.ang + p.wristF) * R;
    const base = aF.wr, tipBase = {x: base.x + Math.cos(d) * 70, y: base.y + Math.sin(d) * 70};
    const n = {x: -Math.sin(d), y: Math.cos(d)};
    const lag = clamp(propLag, -60, 60);
    const c1 = {x: tipBase.x + Math.cos(d) * 40 + n.x * (24 + lag), y: tipBase.y + Math.sin(d) * 40 + n.y * (24 + lag)};
    const end = {x: tipBase.x + Math.cos(d) * 60 + n.x * (70 + lag * 1.6), y: tipBase.y + Math.sin(d) * 60 + n.y * (70 + lag * 1.6)};
    propEl = <g><path d={`M ${base.x} ${base.y} L ${tipBase.x} ${tipBase.y}`} stroke={ink} strokeWidth={11} strokeLinecap="round" /><path d={`M ${base.x} ${base.y} L ${tipBase.x} ${tipBase.y}`} stroke="#6b4e36" strokeWidth={5} strokeLinecap="round" />
      <path d={`M ${tipBase.x} ${tipBase.y} Q ${c1.x} ${c1.y} ${end.x} ${end.y}`} stroke="#4a3626" strokeWidth={3.5} fill="none" strokeLinecap="round" /></g>;
  }
  if (prop === 'whipSash') {
    propEl = <g><path d={`M ${44 * L.build} -46 L ${70 * L.build} 12`} stroke={ink} strokeWidth={11} strokeLinecap="round" /><path d={`M ${44 * L.build} -46 L ${70 * L.build} 12`} stroke="#6b4e36" strokeWidth={5} strokeLinecap="round" />
      <path d={`M ${70 * L.build} 12 Q ${86 * L.build} 50 ${70 * L.build} 90 Q ${60 * L.build} 112 ${74 * L.build} 128`} stroke="#4a3626" strokeWidth={3.5} fill="none" strokeLinecap="round" /></g>;
  }
  if (prop === 'banner') {
    const g = aF.wr;
    const wave = (k: number) => Math.sin(t / 14 + k) * 8 * (1 + p.sway * 0.05);
    const top = {x: g.x + 6, y: g.y - 330};
    propEl = <g>
      <path d={`M ${g.x + 2} ${g.y + 90} L ${top.x} ${top.y}`} stroke={ink} strokeWidth={11} strokeLinecap="round" /><path d={`M ${g.x + 2} ${g.y + 90} L ${top.x} ${top.y}`} stroke="#6b4e36" strokeWidth={5} />
      <path d={`M ${top.x} ${top.y + 10} Q ${top.x + 60} ${top.y + 4 + wave(0)} ${top.x + 120} ${top.y + 14 + wave(1)} L ${top.x + 116} ${top.y + 190 + wave(2)} Q ${top.x + 60} ${top.y + 176 + wave(1.5)} ${top.x} ${top.y + 186} Z`} fill="#a5492c" stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      <path d={`M ${top.x + 14} ${top.y + 30} L ${top.x + 100} ${top.y + 36 + wave(0.5)} M ${top.x + 14} ${top.y + 168} L ${top.x + 100} ${top.y + 172 + wave(2)}`} stroke="#e8d8b8" strokeWidth={3} opacity={0.7} />
      <text transform={`translate(${top.x + 58} 0) scale(${p.facing} 1) translate(${-(top.x + 58)} 0)`} x={top.x + 58} y={top.y + 120 + wave(1.2) * 0.5} fontFamily="Noto Serif CJK SC, serif" fontWeight={900} fontSize={70} textAnchor="middle" fill="#2c2b26" opacity={0.85}>•</text>
      <path d={`M ${top.x - 10} ${top.y} L ${top.x + 10} ${top.y}`} stroke={ink} strokeWidth={5} />
      <HandShape at={g} ang={-90} kind="fist" L={L} />
    </g>;
  }
  const scab = L.armour && L.hat === 'knot' ? <g transform={`translate(${hip.x - 30} ${hip.y - 18}) rotate(${58 + p.lean * 0.3})`}><rect x={0} y={-7} width={150} height={14} rx={6} fill="#3a2a20" stroke={ink} strokeWidth={4} /><rect x={-26} y={-9} width={28} height={18} rx={3} fill="#6b4e36" stroke={ink} strokeWidth={3} /><path d="M 2 -16 V 16" stroke={ink} strokeWidth={6} /></g> : null;
  return <g transform={`translate(${p.x} ${p.y}) scale(${p.facing * p.scale} ${p.scale})`}>
    {shadow ? <ellipse cx={(p.footB.x + p.footF.x) / 2 + 10} cy={2} rx={110} ry={16} fill={ink} opacity={0.18} /> : null}
    <g transform={up}>{ArmDraw(aB, p.handB, p.wristB, false)}</g>
    {scab}
    <LegDraw hip={hB} knee={lB.knee} ankle={lB.ankle} L={L} lift={p.footB.lift} />
    <LegDraw hip={hF} knee={lF.knee} ankle={lF.ankle} L={L} lift={p.footF.lift} />
    <path d={skirt} fill={L.robe} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
    <path d={`M ${(wl.x + wr.x) / 2 + 14} ${wl.y} Q ${(kMinX + kMaxX) / 2 + 20} ${(wl.y + hemY) / 2} ${(kMinX + kMaxX) / 2 + 10} ${hemY + 4}`} stroke={L.robeShade} strokeWidth={5} fill="none" />
    {L.armour ? <Lamellar id={`${id}-tas`} d={tassets} A={L.armour} ink={ink} x0={kMinX - 20} x1={kMaxX + 20} y0={wl.y - 6} y1={tasY + 14} row={16} col={14} /> : null}
    <g transform={up}>
      {p.armFBehind ? ArmDraw(aF, p.handF, p.wristF, true) : null}
      <rect x={-4} y={-196} width={28} height={50} rx={6} fill={L.skin} stroke={ink} strokeWidth={4} />
      {L.armour ? <g>
        <path d={torso} fill={L.robe} stroke={ink} strokeWidth={4.5} />
        <Lamellar id={`${id}-cu`} d={`M ${-42 * w} -152 Q 2 -160 ${44 * w} -154 Q ${54 * w} -120 ${50 * w} -60 L ${45 * w} -24 L ${-40 * w} -24 Q ${-48 * w} -70 ${-46 * w} -128 Z`} A={L.armour} ink={ink} x0={-60} x1={62} y0={-162} y1={-20} />
        <path d={`M -14 -168 L 8 -138 L 28 -170`} fill="none" stroke={L.robe} strokeWidth={14} strokeLinejoin="round" />
        <path d={`M -14 -168 L 8 -138 L 28 -170`} fill="none" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
        <path d={`M -8 -166 L 8 -144 L 22 -168`} fill="none" stroke={L.trim} strokeWidth={2.5} />
        <path d={`M ${-40 * w} -142 L ${-30 * w} -158 M ${42 * w} -144 L ${32 * w} -160`} stroke={L.armour.cord} strokeWidth={5} strokeLinecap="round" />
      </g> : <g>
        <path d={torso} fill={L.robe} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
        <path d={`M ${-28 * w} -160 Q ${4} -112 ${40 * w} -56`} stroke={L.trim} strokeWidth={13} fill="none" />
        <path d={`M ${-28 * w} -160 Q ${4} -112 ${40 * w} -56`} stroke={ink} strokeWidth={2} fill="none" opacity={0.6} />
        <path d={`M ${30 * w} -162 Q ${10} -142 ${-2} -130`} stroke={L.trim} strokeWidth={11} fill="none" />
        <path d={`M ${-42 * w} -120 Q ${-30 * w} -80 ${-40 * w} -40`} stroke={L.robeShade} strokeWidth={6} fill="none" opacity={0.8} />
      </g>}
      {/* sash with knot and trailing ends (secondary motion via sway) */}
      <path d={`M ${-48 * w} -44 L ${52 * w} -44 L ${52 * w} -24 L ${-46 * w} -24 Z`} fill={L.sash} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
      <path d={`M ${30 * w} -34 q ${4 + p.sway * 0.2} 30 ${-2 + p.sway} 56 l 12 2 q ${-2 + p.sway * 0.5} -28 ${0} -56 Z`} fill={L.sash} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
      <path d={`M ${38 * w} -34 q ${10 + p.sway * 0.3} 22 ${10 + p.sway * 1.2} 44 l 11 -3 q ${-4 + p.sway * 0.5} -22 ${-12} -42 Z`} fill={L.sash} stroke={ink} strokeWidth={3.5} strokeLinejoin="round" />
      <ellipse cx={34 * w} cy={-34} rx={11} ry={9} fill={L.sash} stroke={ink} strokeWidth={3.5} />
      <g transform={`translate(9 -176) rotate(${p.headTilt}) translate(0 -50) scale(1.08)`}><Head p={p} L={L} id={id} /></g>
      {!p.armFBehind ? ArmDraw(aF, p.handF, p.wristF, true) : null}
    </g>
    {propEl ? <g transform={up}>{propEl}</g> : null}
  </g>;
};
