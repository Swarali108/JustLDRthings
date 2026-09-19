import type { Flower, Greenery } from "@/lib/flowers";

/**
 * Flowers and leaves drawn as SVG from their spec.
 *
 * Drawn rather than shipped as artwork so a whole bouquet costs a handful of ids
 * in a share link instead of megabytes of images — and so it stays sharp at any
 * size and prints cleanly from the downloaded keepsake.
 *
 * Everything is deterministic: petals are laid out by index around a circle, so
 * the same flower renders identically on every machine and on every reload.
 */

/** One petal path, shaped by the flower's style. */
function petalPath(shape: Flower["shape"]): string {
  switch (shape) {
    case "narrow":
      return "M 0 0 C 3 -14, 3 -30, 0 -40 C -3 -30, -3 -14, 0 0 Z";
    case "pointed":
      return "M 0 0 C 8 -12, 8 -28, 0 -38 C -8 -28, -8 -12, 0 0 Z";
    case "star":
      return "M 0 0 C 5 -10, 4 -26, 0 -40 C -4 -26, -5 -10, 0 0 Z";
    case "ruffled":
      return "M 0 0 C 14 -10, 16 -26, 6 -34 C 1 -38, -1 -38, -6 -34 C -16 -26, -14 -10, 0 0 Z";
    case "rosette":
      return "M 0 0 C 10 -8, 12 -20, 0 -28 C -12 -20, -10 -8, 0 0 Z";
    case "round":
    default:
      return "M 0 0 C 13 -9, 15 -27, 0 -36 C -15 -27, -13 -9, 0 0 Z";
  }
}

export function FlowerArt({ flower, size = 56 }: { flower: Flower; size?: number }) {
  const path = petalPath(flower.shape);
  const gradId = `g-${flower.id}`;
  // A rosette reads as layered leaves, so the inner ring is drawn smaller.
  const twoRing = flower.shape === "rosette" || flower.petals > 10;

  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      role="img"
      aria-label={flower.label}
      className="flower-art"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="80%" r="80%">
          <stop offset="0%" stopColor={flower.inner} />
          <stop offset="100%" stopColor={flower.color} />
        </radialGradient>
      </defs>

      {twoRing ? (
        <g opacity="0.85">
          {Array.from({ length: flower.petals }, (_, i) => (
            <path
              key={`b-${i}`}
              d={path}
              fill={flower.color}
              transform={`rotate(${(360 / flower.petals) * i + 360 / flower.petals / 2}) scale(0.78)`}
            />
          ))}
        </g>
      ) : null}

      {Array.from({ length: flower.petals }, (_, i) => (
        <path
          key={i}
          d={path}
          fill={`url(#${gradId})`}
          transform={`rotate(${(360 / flower.petals) * i})`}
        />
      ))}

      <circle r={flower.shape === "rosette" ? 7 : 9} fill={flower.center} />
      {flower.shape !== "rosette" ? (
        <circle r={flower.shape === "narrow" ? 5 : 4} fill={flower.inner} opacity="0.55" />
      ) : null}
    </svg>
  );
}

/** A sprig of filler greenery: a stem with leaf pairs along it. */
export function LeafArt({ leaf, size = 56 }: { leaf: Greenery; size?: number }) {
  const pairs = Array.from({ length: leaf.leaves }, (_, i) => i);
  const step = 74 / leaf.leaves;

  function leafShape(side: 1 | -1, y: number, i: number) {
    const tone = i % 2 === 0 ? leaf.color : leaf.tone;
    switch (leaf.shape) {
      case "round":
        return <ellipse key={`${side}-${i}`} cx={side * 11} cy={y} rx="9" ry="8" fill={tone} />;
      case "seeded":
        return <circle key={`${side}-${i}`} cx={side * 8} cy={y} r="3.6" fill={tone} />;
      case "willow":
        return (
          <ellipse
            key={`${side}-${i}`}
            cx={side * 9}
            cy={y}
            rx="3"
            ry="11"
            fill={tone}
            transform={`rotate(${side * 22} ${side * 9} ${y})`}
          />
        );
      case "broad":
        return (
          <ellipse
            key={`${side}-${i}`}
            cx={side * 14}
            cy={y}
            rx="13"
            ry="8"
            fill={tone}
            transform={`rotate(${side * -22} ${side * 14} ${y})`}
          />
        );
      case "sprig":
      default:
        return (
          <ellipse
            key={`${side}-${i}`}
            cx={side * 11}
            cy={y}
            rx="9"
            ry="5.5"
            fill={tone}
            transform={`rotate(${side * -28} ${side * 11} ${y})`}
          />
        );
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="-30 -46 60 92"
      role="img"
      aria-label={leaf.label}
      className="leaf-art"
    >
      <path d="M 0 44 C -2 18, -1 -8, 0 -42" stroke={leaf.color} strokeWidth="2.2" fill="none" />
      {pairs.map((i) => {
        const y = 36 - i * step;
        return (
          <g key={i}>
            {leafShape(1, y, i)}
            {leafShape(-1, y - step / 2, i)}
          </g>
        );
      })}
    </svg>
  );
}
