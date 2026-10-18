// Original Art: the imported image itself, so overlays sit on your own map.
// A blank (New Map) map has no image and shows the open-ocean placeholder.

export function drawOriginalArt(g, { map, source, theme }) {
  if (source?.bitmap) {
    g.drawImage(source.bitmap, 0, 0, map.sourceWidth, map.sourceHeight);
  } else {
    g.fillStyle = theme.placeholderOcean;
    g.fillRect(0, 0, map.sourceWidth, map.sourceHeight);
  }
}
