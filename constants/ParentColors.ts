/**
 * Colour presets a guardian can pick as their personal calendar colour.
 *
 * The set is derived from the Okabe-Ito and ColorBrewer "Dark2" palettes, which
 * are chosen so that neighbouring entries stay distinguishable for the common
 * forms of colour blindness (deuteranopia / protanopia / tritanopia). Keeping
 * hue *and* lightness apart is what makes two guardians' bars readable when
 * they sit next to each other on the same calendar day.
 */
export const PARENT_COLOR_PALETTE = [
  { value: "#0072B2", name: "Ocean" },
  { value: "#56B4E9", name: "Sky" },
  { value: "#009E73", name: "Jade" },
  { value: "#1B7837", name: "Forest" },
  { value: "#E69F00", name: "Amber" },
  { value: "#D55E00", name: "Vermillion" },
  { value: "#B2182B", name: "Brick" },
  { value: "#CC79A7", name: "Orchid" },
  { value: "#7570B3", name: "Iris" },
  { value: "#A6761D", name: "Bronze" },
  { value: "#666666", name: "Graphite" },
  { value: "#00838F", name: "Lagoon" },
] as const;

/**
 * Fallback colours used when a guardian has not picked a personal colour yet.
 * Assigned by position in the guardian list, so every parent still gets a
 * distinct colour out of the box.
 */
export const PARENT_COLOR_FALLBACKS = PARENT_COLOR_PALETTE.map(
  (entry) => entry.value,
);

/** Colour used for a one-off override handed to somebody outside the app. */
export const CUSTODY_OVERRIDE_THIRD_PARTY_COLOR = "#7D5BA6";

/** Colour used for a one-off "nobody has responsibility" override. */
export const CUSTODY_OVERRIDE_NO_ONE_COLOR = "#9AA0A6";
