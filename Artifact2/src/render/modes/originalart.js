// Original Art: the art image if one is set (SPEC 2.5.1), else the imported
// image itself, so overlays sit on your own map. A blank (New Map) map with
// no art shows the open-ocean placeholder.

export function drawOriginalArt(g, { map, source, theme }) {
  const bitmap = source?.art?.bitmap ?? source?.bitmap;
  if (bitmap) {
    g.drawImage(bitmap, 0, 0, map.sourceWidth, map.sourceHeight);
  } else {
    g.fillStyle = theme.placeholderOcean;
    g.fillRect(0, 0, map.sourceWidth, map.sourceHeight);
  }
}
