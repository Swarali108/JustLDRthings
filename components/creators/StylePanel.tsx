"use client";

import {
  THEMES,
  FONTS,
  ALIGNS,
  STICKERS,
  MAX_STICKERS,
  THEME_LABELS,
  FONT_LABELS,
  ALIGN_LABELS,
  STYLE_PRESETS,
  matchingPreset,
  type ItemStyle,
  type Sticker
} from "@/lib/style";

/**
 * The "dress it up" controls: colour, lettering, placement, decorations.
 *
 * Every control is a toggle button rather than a `<select>` so the whole set is
 * visible at once — choosing a look is a browsing task, not a form-filling one.
 * `aria-pressed` carries the state, so it reads correctly to a screen reader
 * without needing a radio group per row.
 */
export function StylePanel({
  value,
  onChange
}: {
  value: ItemStyle;
  onChange: (next: ItemStyle) => void;
}) {
  function set<K extends keyof ItemStyle>(key: K, next: ItemStyle[K]) {
    onChange({ ...value, [key]: next });
  }

  function toggleSticker(sticker: Sticker) {
    const has = value.stickers.includes(sticker);
    if (has) {
      set(
        "stickers",
        value.stickers.filter((s) => s !== sticker)
      );
      return;
    }
    if (value.stickers.length >= MAX_STICKERS) return;
    set("stickers", [...value.stickers, sticker]);
  }

  const activePreset = matchingPreset(value);

  return (
    <div className="style-panel">
      <span className="style-legend">Start from a look</span>
      <div className="style-row">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="style-chip"
            aria-pressed={activePreset === preset.id}
            onClick={() => onChange(preset.style)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <span className="style-legend">Colour</span>
      <div className="style-row">
        {THEMES.map((theme) => (
          <button
            key={theme}
            type="button"
            className="style-chip"
            aria-pressed={value.theme === theme}
            onClick={() => set("theme", theme)}
          >
            {THEME_LABELS[theme]}
          </button>
        ))}
      </div>

      <span className="style-legend">Lettering</span>
      <div className="style-row">
        {FONTS.map((font) => (
          <button
            key={font}
            type="button"
            className={`style-chip font-${font}`}
            aria-pressed={value.font === font}
            onClick={() => set("font", font)}
          >
            {FONT_LABELS[font]}
          </button>
        ))}
      </div>

      <span className="style-legend">Placement</span>
      <div className="style-row">
        {ALIGNS.map((align) => (
          <button
            key={align}
            type="button"
            className="style-chip"
            aria-pressed={value.align === align}
            onClick={() => set("align", align)}
          >
            {ALIGN_LABELS[align]}
          </button>
        ))}
        {[-3, -1, 0, 1, 3].map((tilt) => (
          <button
            key={tilt}
            type="button"
            className="style-chip"
            aria-pressed={value.tilt === tilt}
            onClick={() => set("tilt", tilt)}
            aria-label={tilt === 0 ? "No tilt" : `Tilt ${tilt} degrees`}
          >
            {tilt === 0 ? "Straight" : `${tilt > 0 ? "+" : ""}${tilt}°`}
          </button>
        ))}
      </div>

      <span className="style-legend">
        Little extras{" "}
        <span style={{ textTransform: "none", letterSpacing: 0 }}>
          ({value.stickers.length}/{MAX_STICKERS})
        </span>
      </span>
      <div className="style-row">
        {STICKERS.map((sticker) => {
          const on = value.stickers.includes(sticker);
          return (
            <button
              key={sticker}
              type="button"
              className="style-chip sticker-chip"
              aria-pressed={on}
              aria-label={on ? `Remove ${sticker}` : `Add ${sticker}`}
              disabled={!on && value.stickers.length >= MAX_STICKERS}
              onClick={() => toggleSticker(sticker)}
            >
              {sticker}
            </button>
          );
        })}
      </div>
    </div>
  );
}
