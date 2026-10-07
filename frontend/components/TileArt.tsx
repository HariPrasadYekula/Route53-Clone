const INK = "#232f3e";
const ACC = "#5f7bff";

function Shield({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -34 L28 -24 V4 C28 20 14 30 0 38 C-14 30 -28 20 -28 4 V-24 Z" fill="#fff" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <text x="0" y="9" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="700" fontSize="24" fill={INK}>53</text>
    </g>
  );
}
const dash = { stroke: ACC, strokeWidth: 1.5, strokeDasharray: "4 4", fill: "none" } as const;
const Box = ({ x, y }: { x: number; y: number }) => <rect x={x} y={y} width="46" height="34" rx="3" fill="#fff" stroke={INK} strokeWidth="2.5" />;

export default function TileArt({ kind }: { kind: "domain" | "transfer" | "zones" | "health" | "flow" | "resolver" }) {
  return (
    <svg viewBox="0 0 300 110" width="100%" height="110" aria-hidden="true">
      {kind === "domain" && (<><path d="M110 55 C140 30 160 30 190 55 M110 55 C140 80 160 80 190 55" {...dash} /><Box x={185} y={38} /><Shield x={95} y={55} s={0.9} /></>)}
      {kind === "transfer" && (<><path d="M70 55 H112 M188 55 H230" {...dash} /><Box x={30} y={38} /><Box x={226} y={38} /><Shield x={150} y={55} s={0.95} /></>)}
      {kind === "zones" && (<><path d="M80 40 L130 55 M220 40 L170 55" {...dash} /><Shield x={80} y={40} s={0.4} /><Shield x={220} y={40} s={0.4} /><Shield x={150} y={58} s={0.9} /></>)}
      {kind === "health" && (<><path d="M20 62 H70 L80 30 L92 90 L104 40 L112 62 H118 M182 62 H188 L196 40 L208 90 L220 30 L230 62 H280" stroke={ACC} strokeWidth="2" fill="none" /><Shield x={150} y={58} s={0.9} /></>)}
      {kind === "flow" && (<><path d="M110 58 C140 58 150 28 190 28 M110 58 H190 M110 58 C140 58 150 88 190 88" {...dash} /><circle cx="195" cy="28" r="6" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="195" cy="58" r="6" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="195" cy="88" r="6" fill="#fff" stroke={INK} strokeWidth="2" /><Shield x={90} y={58} s={0.9} /></>)}
      {kind === "resolver" && (<><path d="M70 58 H112 M188 58 H225" {...dash} /><rect x="30" y="38" width="40" height="40" rx="3" fill="#fff" stroke={INK} strokeWidth="2.5" /><path d="M225 70 a14 14 0 0 1 4 -27 a18 18 0 0 1 34 4 a12 12 0 0 1 -2 23 z" fill="#fff" stroke={INK} strokeWidth="2.5" /><Shield x={150} y={58} s={0.95} /></>)}
    </svg>
  );
}
