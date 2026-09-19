import type { Flower, Greenery } from "@/lib/flowers";

/**
 * Flowers and leaves, drawn as SVG from their spec.
 *
 * Exported in two forms deliberately:
 *   - `FlowerGlyph` / `LeafGlyph` return a `<g>` for embedding in a bigger
 *     drawing — the bouquet is one SVG so every stem can share a coordinate
 *     space and converge on a single tie point.
 *   - `FlowerArt` / `LeafArt` wrap those in their own `<svg>` for the pickers.
 *
 * Drawn rather than shipped as artwork so a whole bouquet costs a handful of ids
 * in a share link instead of megabytes of images, and stays sharp at any size.
 *
 * A glyph is centred on the origin; a leaf grows UP from it, so the origin can
 * be placed at the tie and the sprig rotated outward.
 */

function petalPath(shape: Flower["shape"]): string {
  switch (shape) {
    case "narrow":
      return "M 0 0 C 3 -14, 3 -30, 0 -42 C -3 -30, -3 -14, 0 0 Z";
    case "pointed":
      return "M 0 0 C 8 -12, 8 -28, 0 -40 C -8 -28, -8 -12, 0 0 Z";
    case "star":
      return "M 0 0 C 5 -10, 4 -26, 0 -42 C -4 -26, -5 -10, 0 0 Z";
    case "ruffled":
      return "M 0 0 C 14 -10, 16 -26, 6 -34 C 1 -38, -1 -38, -6 -34 C -16 -26, -14 -10, 0 0 Z";
    case "rosette":
      return "M 0 0 C 10 -8, 12 -20, 0 -28 C -12 -20, -10 -8, 0 0 Z";
    case "round":
    default:
      return "M 0 0 C 13 -9, 15 -27, 0 -36 C -15 -27, -13 -9, 0 0 Z";
  }
}

/** The bloom head, centred on the origin, spanning roughly 100 units. */
export function FlowerGlyph({ flower, idSuffix = "" }: { flower: Flower; idSuffix?: string }) {
  const path = petalPath(flower.shape);
  const gradId = `fg-${flower.id}${idSuffix}`;
  const twoRing = flower.shape === "rosette" || flower.petals > 10;

  return (
    <g>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="78%" r="82%">
          <stop offset="0%" stopColor={flower.inner} />
          <stop offset="100%" stopColor={flower.color} />
        </radialGradient>
      </defs>

      {twoRing ? (
        <g opacity="0.8">
          {Array.from({ length: flower.petals }, (_, i) => (
            <path
              key={`b-${i}`}
              d={path}
              fill={flower.color}
              transform={`rotate(${(360 / flower.petals) * i + 180 / flower.petals}) scale(0.76)`}
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
        <circle r={flower.shape === "narrow" ? 5 : 4} fill={flower.inner} opacity="0.5" />
      ) : null}
    </g>
  );
}

/** A sprig growing upward from the origin, about 92 units tall. */
export function LeafGlyph({ leaf }: { leaf: Greenery }) {
  const step = 76 / leaf.leaves;

  function blade(side: 1 | -1, y: number, i: number) {
    const tone = i % 2 === 0 ? leaf.color : leaf.tone;
    switch (leaf.shape) {
      case "round":
        return <ellipse key={`${side}-${i}`} cx={side * 10} cy={y} rx="8.5" ry="7.5" fill={tone} />;
      case "seeded":
        return <circle key={`${side}-${i}`} cx={side * 7} cy={y} r="3.4" fill={tone} />;
      case "willow":
        return (
          <ellipse
            key={`${side}-${i}`}
            cx={side * 8}
            cy={y}
            rx="2.8"
            ry="10"
            fill={tone}
            transform={`rotate(${side * 20} ${side * 8} ${y})`}
          />
        );
      case "broad":
        return (
          <ellipse
            key={`${side}-${i}`}
            cx={side * 13}
            cy={y}
            rx="12"
            ry="7.5"
            fill={tone}
            transform={`rotate(${side * -24} ${side * 13} ${y})`}
          />
        );
      case "sprig":
      default:
        return (
          <ellipse
            key={`${side}-${i}`}
            cx={side * 10}
            cy={y}
            rx="8.5"
            ry="5"
            fill={tone}
            transform={`rotate(${side * -30} ${side * 10} ${y})`}
          />
        );
    }
  }

  return (
    <g>
      <path d="M 0 0 C -2 -28, -1 -58, 0 -90" stroke={leaf.color} strokeWidth="2.2" fill="none" />
      {Array.from({ length: leaf.leaves }, (_, i) => {
        const y = -12 - i * step;
        return (
          <g key={i}>
            {blade(1, y, i)}
            {blade(-1, y - step / 2, i)}
          </g>
        );
      })}
    </g>
  );
}

/** Standalone bloom, for the picker. */
export function FlowerArt({ flower, size = 56 }: { flower: Flower; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      role="img"
      aria-label={flower.label}
      className="flower-art"
    >
      <FlowerGlyph flower={flower} idSuffix="-pick" />
    </svg>
  );
}

/** Standalone sprig, for the picker. */
export function LeafArt({ leaf, size = 56 }: { leaf: Greenery; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-26 -98 52 104"
      role="img"
      aria-label={leaf.label}
      className="leaf-art"
    >
      <LeafGlyph leaf={leaf} />
    </svg>
  );
}
