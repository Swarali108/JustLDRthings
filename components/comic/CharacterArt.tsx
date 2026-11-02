import { skinOf, hairColorOf, outfitOf, type Avatar } from "@/lib/avatar";
import type { Pose, Expression } from "@/lib/comic";

/**
 * One character, drawn from their avatar plus a pose and an expression.
 *
 * Drawn rather than generated, which is the whole reason the comic works: the
 * same avatar produces the same face in every panel. A generated picture gives
 * you a different person each time, costs money per panel and takes seconds.
 *
 * The figure stands on the origin's x-axis at y = 0, about 100 units tall, so a
 * panel can place it with a single translate.
 */

/** Arm and leg geometry per pose. Everything else is shared. */
function limbs(pose: Pose) {
  switch (pose) {
    case "waving":
      return {
        armL: "M -11 -56 C -22 -62, -27 -74, -24 -84",
        armR: "M 11 -56 C 20 -48, 22 -38, 20 -30",
        legL: "M -6 -22 L -8 0",
        legR: "M 6 -22 L 8 0",
        lean: 0
      };
    case "hugging":
      return {
        armL: "M -11 -56 C -24 -52, -26 -40, -16 -36",
        armR: "M 11 -56 C 24 -52, 26 -40, 16 -36",
        legL: "M -6 -22 L -8 0",
        legR: "M 6 -22 L 8 0",
        lean: 0
      };
    case "onphone":
      return {
        armL: "M -11 -56 C -18 -48, -18 -38, -14 -32",
        armR: "M 11 -56 C 18 -64, 14 -72, 8 -74",
        legL: "M -6 -22 L -8 0",
        legR: "M 6 -22 L 8 0",
        lean: 0
      };
    case "sitting":
      return {
        armL: "M -11 -48 C -18 -42, -19 -34, -16 -30",
        armR: "M 11 -48 C 18 -42, 19 -34, 16 -30",
        legL: "M -6 -18 C -14 -14, -22 -12, -26 -12",
        legR: "M 6 -18 C 14 -14, 22 -12, 26 -12",
        lean: 0
      };
    case "running":
      return {
        armL: "M -11 -56 C -22 -50, -24 -40, -20 -34",
        armR: "M 11 -56 C 20 -62, 24 -54, 22 -46",
        legL: "M -6 -22 C -16 -16, -20 -8, -22 0",
        legR: "M 6 -22 C 12 -14, 16 -6, 20 -2",
        lean: -8
      };
    case "standing":
    default:
      return {
        armL: "M -11 -56 C -17 -48, -18 -38, -17 -30",
        armR: "M 11 -56 C 17 -48, 18 -38, 17 -30",
        legL: "M -6 -22 L -7 0",
        legR: "M 6 -22 L 7 0",
        lean: 0
      };
  }
}

/** Eyes and mouth per expression. */
function Face({ expression, ink }: { expression: Expression; ink: string }) {
  const eye = (cx: number) => {
    switch (expression) {
      case "laughing":
        return <path key={cx} d={`M ${cx - 4} -74 Q ${cx} -79, ${cx + 4} -74`} stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
      case "sleepy":
        return <path key={cx} d={`M ${cx - 4} -73 L ${cx + 4} -73`} stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
      case "surprised":
        return <circle key={cx} cx={cx} cy={-73} r="3.2" fill="none" stroke={ink} strokeWidth="1.6" />;
      case "shy":
        return <path key={cx} d={`M ${cx - 3.5} -72 Q ${cx} -76, ${cx + 3.5} -72`} stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
      default:
        return <circle key={cx} cx={cx} cy={-73} r="2.2" fill={ink} />;
    }
  };

  const mouth = () => {
    switch (expression) {
      case "laughing":
        return <path d="M -6 -63 Q 0 -55, 6 -63 Z" fill={ink} />;
      case "sad":
        return <path d="M -5 -61 Q 0 -66, 5 -61" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
      case "surprised":
        return <ellipse cx="0" cy="-62" rx="3" ry="4" fill={ink} />;
      case "sleepy":
        return <path d="M -3 -62 L 3 -62" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
      case "shy":
        return <path d="M -4 -63 Q 0 -60, 4 -63" stroke={ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
      default:
        return <path d="M -5 -64 Q 0 -59, 5 -64" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />;
    }
  };

  return (
    <g>
      {eye(-7)}
      {eye(7)}
      {mouth()}
      {expression === "shy" ? (
        <>
          <ellipse cx="-13" cy="-67" rx="4" ry="2.4" fill="#e08b96" opacity="0.6" />
          <ellipse cx="13" cy="-67" rx="4" ry="2.4" fill="#e08b96" opacity="0.6" />
        </>
      ) : null}
      {expression === "sleepy" ? (
        <text x="18" y="-82" fontSize="9" fill={ink} opacity="0.7">z</text>
      ) : null}
    </g>
  );
}

function Hair({ avatar }: { avatar: Avatar }) {
  const c = hairColorOf(avatar).fill;

  switch (avatar.hair) {
    case "buzz":
      return <path d="M -17 -78 A 17 17 0 0 1 17 -78 L 17 -80 A 17 17 0 0 0 -17 -80 Z" fill={c} />;
    case "long":
      return (
        <g fill={c}>
          <path d="M -18 -76 A 18 18 0 0 1 18 -76 L 18 -84 A 18 18 0 0 0 -18 -84 Z" />
          <path d="M -18 -78 C -24 -62, -22 -46, -19 -40 L -13 -42 C -16 -54, -16 -66, -14 -76 Z" />
          <path d="M 18 -78 C 24 -62, 22 -46, 19 -40 L 13 -42 C 16 -54, 16 -66, 14 -76 Z" />
        </g>
      );
    case "bob":
      return (
        <g fill={c}>
          <path d="M -18 -76 A 18 18 0 0 1 18 -76 L 18 -82 A 18 18 0 0 0 -18 -82 Z" />
          <path d="M -18 -78 C -21 -68, -20 -60, -18 -56 L -12 -58 C -14 -64, -14 -72, -13 -78 Z" />
          <path d="M 18 -78 C 21 -68, 20 -60, 18 -56 L 12 -58 C 14 -64, 14 -72, 13 -78 Z" />
        </g>
      );
    case "bun":
      return (
        <g fill={c}>
          <path d="M -18 -76 A 18 18 0 0 1 18 -76 L 18 -84 A 18 18 0 0 0 -18 -84 Z" />
          <circle cx="0" cy="-96" r="7.5" />
        </g>
      );
    case "ponytail":
      return (
        <g fill={c}>
          <path d="M -18 -76 A 18 18 0 0 1 18 -76 L 18 -84 A 18 18 0 0 0 -18 -84 Z" />
          <path d="M 16 -82 C 26 -78, 28 -62, 24 -50 L 19 -52 C 22 -62, 21 -74, 14 -79 Z" />
        </g>
      );
    case "curly":
      return (
        <g fill={c}>
          {[-14, -7, 0, 7, 14].map((x, i) => (
            <circle key={x} cx={x} cy={-86 + (i % 2) * 3} r="7" />
          ))}
          <circle cx="-18" cy="-76" r="6" />
          <circle cx="18" cy="-76" r="6" />
        </g>
      );
    case "wavy":
      return (
        <g fill={c}>
          <path d="M -18 -76 A 18 18 0 0 1 18 -76 L 18 -84 A 18 18 0 0 0 -18 -84 Z" />
          <path d="M -18 -78 C -23 -70, -17 -64, -22 -54 L -15 -52 C -11 -62, -15 -68, -13 -77 Z" />
          <path d="M 18 -78 C 23 -70, 17 -64, 22 -54 L 15 -52 C 11 -62, 15 -68, 13 -77 Z" />
        </g>
      );
    case "short":
    default:
      return (
        <g fill={c}>
          <path d="M -18 -76 A 18 18 0 0 1 18 -76 L 18 -83 A 18 18 0 0 0 -18 -83 Z" />
          <path d="M -18 -78 C -19 -72, -18 -68, -17 -66 L -13 -68 C -14 -72, -14 -76, -14 -78 Z" />
        </g>
      );
  }
}

function Accessory({ avatar, ink }: { avatar: Avatar; ink: string }) {
  const hair = hairColorOf(avatar).fill;

  switch (avatar.accessory) {
    case "glasses":
      return (
        <g stroke={ink} strokeWidth="1.5" fill="none">
          <circle cx="-7" cy="-73" r="5.5" />
          <circle cx="7" cy="-73" r="5.5" />
          <path d="M -1.5 -73 L 1.5 -73" />
        </g>
      );
    case "sunglasses":
      return (
        <g fill="#2b2d33">
          <rect x="-13" y="-77" width="11" height="8" rx="3" />
          <rect x="2" y="-77" width="11" height="8" rx="3" />
          <rect x="-2" y="-74" width="4" height="1.6" />
        </g>
      );
    case "earrings":
      return (
        <g fill="#d4af62">
          <circle cx="-17" cy="-68" r="2.2" />
          <circle cx="17" cy="-68" r="2.2" />
        </g>
      );
    case "cap":
      return (
        <g fill={outfitOf(avatar).shade}>
          <path d="M -18 -80 A 18 18 0 0 1 18 -80 L 18 -84 A 18 18 0 0 0 -18 -84 Z" />
          <path d="M -19 -80 L -30 -77 L -30 -74 L -18 -76 Z" />
        </g>
      );
    case "scarf":
      return (
        <g fill="#c2415f">
          <path d="M -13 -56 Q 0 -50, 13 -56 L 13 -50 Q 0 -44, -13 -50 Z" />
          <path d="M 8 -51 L 12 -36 L 6 -36 L 4 -50 Z" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M -19 -76 A 19 19 0 0 1 19 -76" stroke={hair === "#241c1a" ? "#4a4a52" : "#241c1a"} strokeWidth="2.6" fill="none" />
          <rect x="-23" y="-78" width="7" height="11" rx="3" fill="#4a4a52" />
          <rect x="16" y="-78" width="7" height="11" rx="3" fill="#4a4a52" />
        </g>
      );
    default:
      return null;
  }
}

export function CharacterArt({
  avatar,
  pose,
  expression,
  flip = false
}: {
  avatar: Avatar;
  pose: Pose;
  expression: Expression;
  flip?: boolean;
}) {
  const skin = skinOf(avatar);
  const outfit = outfitOf(avatar);
  const ink = "#2b2029";
  const l = limbs(pose);
  const sit = pose === "sitting" ? 14 : 0;

  return (
    <g transform={`${flip ? "scale(-1,1) " : ""}rotate(${l.lean}) translate(0 ${sit})`}>
      {/* legs and arms sit behind the body */}
      <g stroke={skin.shade} strokeWidth="6" strokeLinecap="round" fill="none">
        <path d={l.legL} />
        <path d={l.legR} />
      </g>

      <g stroke={outfit.fill} strokeWidth="6.5" strokeLinecap="round" fill="none">
        <path d={l.armL} />
        <path d={l.armR} />
      </g>

      {/* body */}
      <path d="M -12 -58 Q 0 -62, 12 -58 L 14 -22 Q 0 -18, -14 -22 Z" fill={outfit.fill} />
      <path d="M -12 -58 Q 0 -62, 12 -58 L 12.6 -47 Q 0 -51, -12.6 -47 Z" fill={outfit.shade} opacity="0.5" />

      {/* phone, drawn in the raised hand */}
      {pose === "onphone" ? <rect x="4" y="-80" width="7" height="11" rx="2" fill="#2b2d33" /> : null}

      {/* head */}
      <circle cx="0" cy="-70" r="18" fill={skin.fill} />
      <path d="M -18 -70 A 18 18 0 0 0 18 -70 Z" fill={skin.shade} opacity="0.18" />
      <Hair avatar={avatar} />
      <Face expression={expression} ink={ink} />
      <Accessory avatar={avatar} ink={ink} />
    </g>
  );
}
