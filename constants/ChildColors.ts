/**
 * Shared color palette for identifying a child throughout the calendar UI
 * (combined-calendar dots/legend, single-child calendar accents, etc).
 *
 * Colors are drawn from the Okabe-Ito colorblind-safe palette and extended
 * with a few extra, well-separated hues so families with more than 8
 * children still get unique automatic colors. Used both as:
 *  - the default palette children are auto-assigned from (by index), and
 *  - the swatch choices offered in the "Calendar Color" picker in
 *    child-settings.tsx so a guardian can pick a specific color instead.
 */
export const CHILD_COLOR_SWATCHES = [
  "#E69F00", // orange
  "#56B4E9", // sky blue
  "#009E73", // bluish green
  "#F0C808", // yellow
  "#0072B2", // blue
  "#D55E00", // vermillion
  "#CC79A7", // reddish purple
  "#17A398", // teal
  "#7B2CBF", // purple
  "#FF6FB5", // pink
  "#8B5E3C", // brown
  "#4A5568", // slate gray
];
