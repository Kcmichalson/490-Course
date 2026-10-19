// Map-area colors for canvas drawing, read from the CSS variables in
// style.css (:root), so every UI color is defined in one place. Call
// readTheme() again after a theme change (themes arrive in M11).

const VARIABLES = {
  mapBg: '--map-bg',
  mapBorder: '--map-border',
  placeholderOcean: '--placeholder-ocean',
  graticuleLine: '--graticule-line',
  graticuleLineStrong: '--graticule-line-strong',
  graticuleLabel: '--graticule-label',
  labelHalo: '--label-halo',
  selection: '--selection',
  selectionHalo: '--selection-halo',
  brushOutline: '--brush-outline',
  brushHalo: '--brush-halo',
  paletteUnmatched: '--palette-unmatched',
};

export function readTheme(el = document.documentElement) {
  const styles = getComputedStyle(el);
  const theme = {};
  for (const [key, name] of Object.entries(VARIABLES)) {
    theme[key] = styles.getPropertyValue(name).trim();
  }
  return theme;
}
