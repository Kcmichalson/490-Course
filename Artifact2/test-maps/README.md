# Test maps

Sample inputs used for milestone verification (SPEC.md section 17).

| File | What it is |
|---|---|
| `gebco_bathy_heightmap.jpg` | Equirectangular Earth heightmap that includes ocean depth. JPEG, so expect compression speckle; the sea-level gray value is set manually on import. |
| `gebco_bathy_BW_heightmap.png` | Silhouette (white land on black) thresholded from the GEBCO image above, so the two line up. |
| `private/` | Git-ignored. Game content (e.g., a Paradox heightmap) used locally only, never committed. |

## Credit

The Earth heightmap and the silhouette derived from it are based on data from
**GEBCO** (General Bathymetric Chart of the Oceans).
