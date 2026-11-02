import type { Background } from "@/lib/comic";

/**
 * Panel backgrounds, drawn as flat SVG shapes in a 300x200 box.
 *
 * Deliberately simple and low-contrast: they have to sit behind characters and
 * under speech bubbles without competing with either. Detail here would make
 * the panel harder to read, not better.
 */
export function BackgroundArt({ background }: { background: Background }) {
  switch (background) {
    case "cafe":
      return (
        <g>
          <rect width="300" height="200" fill="#f2e4d4" />
          <rect y="140" width="300" height="60" fill="#d8bb98" />
          <rect x="18" y="40" width="84" height="64" rx="4" fill="#e7d2b8" />
          <rect x="22" y="44" width="76" height="56" rx="2" fill="#cdb192" />
          <rect x="196" y="56" width="86" height="48" rx="6" fill="#b8926c" opacity="0.55" />
          {[210, 232, 254].map((x) => (
            <rect key={x} x={x} y={64} width="14" height="18" rx="3" fill="#8d6a4a" opacity="0.6" />
          ))}
          <ellipse cx="150" cy="150" rx="46" ry="9" fill="#b58e67" opacity="0.5" />
        </g>
      );

    case "park":
      return (
        <g>
          <rect width="300" height="200" fill="#dceaf2" />
          <rect y="128" width="300" height="72" fill="#bcd6a8" />
          <circle cx="54" cy="96" r="34" fill="#8fb878" />
          <rect x="50" y="118" width="8" height="26" fill="#8a6a4a" />
          <circle cx="252" cy="104" r="26" fill="#9cc287" />
          <rect x="248" y="122" width="7" height="22" fill="#8a6a4a" />
          <circle cx="226" cy="40" r="16" fill="#f6e7bd" opacity="0.8" />
          <path d="M 0 150 Q 150 138, 300 152 L 300 200 L 0 200 Z" fill="#a9c894" opacity="0.7" />
        </g>
      );

    case "bedroom":
      return (
        <g>
          <rect width="300" height="200" fill="#efe3ef" />
          <rect y="146" width="300" height="54" fill="#d6c3cc" />
          <rect x="190" y="70" width="100" height="78" rx="6" fill="#c8a7b8" />
          <rect x="196" y="58" width="88" height="20" rx="8" fill="#f1e2ea" />
          <rect x="22" y="48" width="56" height="44" rx="4" fill="#e3d2de" />
          <circle cx="50" cy="70" r="12" fill="#cbb3c4" />
          <path d="M 110 28 L 118 44 L 136 46 L 123 58 L 127 76 L 110 67 L 93 76 L 97 58 L 84 46 L 102 44 Z" fill="#e8d4a8" opacity="0.65" />
        </g>
      );

    case "airport":
      return (
        <g>
          <rect width="300" height="200" fill="#e3ecf4" />
          <rect y="150" width="300" height="50" fill="#c6d3de" />
          <rect x="14" y="22" width="272" height="86" rx="6" fill="#cfe0ee" />
          {[40, 104, 168, 232].map((x) => (
            <rect key={x} x={x} y={28} width="48" height="74" rx="3" fill="#aecbe2" opacity="0.7" />
          ))}
          <path d="M 196 56 L 242 66 L 252 60 L 246 76 L 214 84 L 222 70 Z" fill="#f4f8fb" />
          <rect x="18" y="116" width="86" height="18" rx="3" fill="#3f4149" />
          <rect x="24" y="121" width="56" height="8" rx="2" fill="#8fc48f" opacity="0.8" />
        </g>
      );

    case "videocall":
      return (
        <g>
          <rect width="300" height="200" fill="#2b2d3a" />
          <rect x="4" y="4" width="144" height="192" rx="8" fill="#3c6f8c" />
          <rect x="152" y="4" width="144" height="192" rx="8" fill="#6a4a73" />
          <rect x="4" y="4" width="144" height="192" rx="8" fill="none" stroke="#f2f4f8" strokeWidth="2" opacity="0.35" />
          <rect x="152" y="4" width="144" height="192" rx="8" fill="none" stroke="#f2f4f8" strokeWidth="2" opacity="0.35" />
          {/* the little connection dot, because this is the long-distance one */}
          <circle cx="150" cy="186" r="4" fill="#8fc48f" />
        </g>
      );

    case "nightsky":
      return (
        <g>
          <rect width="300" height="200" fill="#232745" />
          <rect y="0" width="300" height="200" fill="url(#nightfade)" opacity="0.5" />
          <defs>
            <linearGradient id="nightfade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b1e38" />
              <stop offset="100%" stopColor="#4a3a5c" />
            </linearGradient>
          </defs>
          <circle cx="238" cy="44" r="19" fill="#f3e6c0" />
          <circle cx="231" cy="39" r="16" fill="#232745" opacity="0.55" />
          {[[30, 32], [70, 66], [112, 26], [160, 54], [196, 90], [60, 110], [268, 120], [132, 92]].map(
            ([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.2 : 1.4} fill="#f6f2e4" opacity="0.85" />
            )
          )}
          <path d="M 0 164 Q 80 146, 160 162 T 300 156 L 300 200 L 0 200 Z" fill="#1a1c2c" />
        </g>
      );

    case "station":
      return (
        <g>
          <rect width="300" height="200" fill="#e6e2db" />
          <rect y="142" width="300" height="58" fill="#b9b2a8" />
          <rect y="158" width="300" height="6" fill="#8d867b" />
          <rect y="176" width="300" height="6" fill="#8d867b" />
          <rect x="10" y="20" width="280" height="14" rx="3" fill="#6f6a62" />
          {[46, 150, 254].map((x) => (
            <rect key={x} x={x - 5} y={34} width="10" height="108" fill="#8d867b" opacity="0.6" />
          ))}
          <rect x="188" y="60" width="104" height="54" rx="4" fill="#9fb3c4" opacity="0.65" />
          <rect x="196" y="68" width="88" height="38" rx="2" fill="#7d93a8" opacity="0.6" />
        </g>
      );

    default:
      return <rect width="300" height="200" fill="#efe9e2" />;
  }
}
