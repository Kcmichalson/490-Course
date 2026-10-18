# Test maps

Sample inputs used for milestone verification (SPEC.md section 17).

| File | What it is |
|---|---|
| `gebco_bathy_heightmap.jpg` | Equirectangular Earth heightmap that includes ocean depth. JPEG, so expect compression speckle; the sea-level gray value is set manually on import. |
| `gebco_bathy_BW_heightmap.png` | Silhouette (white land on black) thresholded from the GEBCO image above, so the two line up. |
| `archipeligo_map_1.png` | Generated archipelago (made by me with a noise map generator). Small islands, ocean along all edges, so it's a clean non-wrapping test. |
| `archipeligo_map_2.png` | Generated archipelago, like the one above with a different layout. Ocean along all edges. |
| `continent_map_1.png` | Generated continents with lots of land. Land touches top and bottom edges. |
| `continent_map_2.png` | Generated scattered mid-sized landmasses. A few pixels touching in the south but mostly disconnected islands. |
| `continent_map_3.png` | Generated large landmass, useful for testing continental interiors. Land touches top and bottom edges. |
| `continent_map_4.png` | Generated single supercontinent near the center. Land touches top and bottom edges. |
| `private/` | Git-ignored. |


## Credit

The Earth heightmap and the silhouette derived from it are based on data from
**GEBCO** (General Bathymetric Chart of the Oceans).
Generated maps by https://fantasymapsymbols.com/continent-coastline-map-shape-generator-1
