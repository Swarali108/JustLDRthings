"use client";

import {
  SKIN_TONES,
  HAIR_STYLES,
  HAIR_COLORS,
  OUTFIT_COLORS,
  ACCESSORIES,
  HAIR_LABELS,
  ACCESSORY_LABELS,
  type Avatar
} from "@/lib/avatar";
import { CharacterArt } from "@/components/comic/CharacterArt";

/**
 * Build one of the two characters.
 *
 * Every choice previews on the figure immediately, because "Umber" and "Wavy"
 * mean nothing as words — you pick a face by looking at it.
 */
export function AvatarBuilder({
  label,
  value,
  onChange
}: {
  label: string;
  value: Avatar;
  onChange: (next: Avatar) => void;
}) {
  const set = <K extends keyof Avatar>(key: K, next: Avatar[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div className="avatar-builder">
      <div className="avatar-preview">
        <svg viewBox="-45 -105 90 112" role="img" aria-label={`${label} preview`}>
          <CharacterArt avatar={value} pose="waving" expression="happy" />
        </svg>
        <input
          className="avatar-name"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={label}
          aria-label={`${label} name`}
          maxLength={24}
        />
      </div>

      <div className="avatar-options">
        <span className="style-legend">Skin</span>
        <div className="style-row">
          {SKIN_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className="swatch-chip"
              aria-label={tone.label}
              aria-pressed={value.skin === tone.id}
              style={{ background: tone.fill }}
              onClick={() => set("skin", tone.id)}
            />
          ))}
        </div>

        <span className="style-legend">Hair</span>
        <div className="style-row">
          {HAIR_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              className="style-chip"
              aria-pressed={value.hair === style}
              onClick={() => set("hair", style)}
            >
              {HAIR_LABELS[style]}
            </button>
          ))}
        </div>

        <div className="style-row">
          {HAIR_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="swatch-chip"
              aria-label={`${c.label} hair`}
              aria-pressed={value.hairColor === c.id}
              style={{ background: c.fill }}
              onClick={() => set("hairColor", c.id)}
            />
          ))}
        </div>

        <span className="style-legend">Outfit</span>
        <div className="style-row">
          {OUTFIT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="swatch-chip"
              aria-label={`${c.label} outfit`}
              aria-pressed={value.outfit === c.id}
              style={{ background: c.fill }}
              onClick={() => set("outfit", c.id)}
            />
          ))}
        </div>

        <span className="style-legend">Extras</span>
        <div className="style-row">
          {ACCESSORIES.map((a) => (
            <button
              key={a}
              type="button"
              className="style-chip"
              aria-pressed={value.accessory === a}
              onClick={() => set("accessory", a)}
            >
              {ACCESSORY_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
