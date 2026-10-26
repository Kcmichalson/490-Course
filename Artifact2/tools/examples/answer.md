# Map companion: question-empires.md

- **Question:** question-empires.md
- **Map:** fcm-map-data-1024x512.bin.gz (1024 × 512 cells, latitude 90° to -90°, longitude -180° spanning 360°, wraps east-west, planet radius 6371 km)
- **Picture:** fcm-map-koppen.png
- **Generated:** 2026-10-25 20:48 by Claude Code headless (`claude -p`, Claude desktop app bundle, safe mode off), model claude-opus-5-5
- **Checks passed:** sections, placements JSON, on land, climate matches the map (attempt 1 of 2)
- **Map tool calls:** 17 (overview ×1, point ×16); listed in answer.toolcalls.jsonl

*Written by tools/companion.py. The answer below is the model's; the checks above are the code's, against tools/mapquery.py.*

---

## Placements

On this map Britain is subarctic and the American plains are cold desert, so several obvious Earth-like choices didn't work. I checked each site below with the point tool and kept only the ones whose climate fits.

```json
[
  {"name": "The Ashen Throne (capital oasis of the salt empire)", "lat": 26.0, "lon": 15.0, "koppen": "BWh", "reasons": "Hot desert in the middle of the great northern desert belt. Rain totals only 242 mm a year, and October to February are almost completely dry. The warmest month reaches 26.9 °C and the annual mean is 18.6 °C. Dry basins like this leave salt flats behind, and the short summer rains from April to August (up to 57.8 mm in July) can refill oasis springs and cisterns. That is enough to support walled oasis cities that live off salt caravans."},
  {"name": "The Verdant League (river city-states of the great southern river)", "lat": 16.0, "lon": 104.0, "koppen": "Aw", "reasons": "Low floodplain at 58 m elevation, warm all year: the coldest month is 19.2 °C, above the 18 °C tropical threshold. A strong wet season brings 164 to 206 mm a month from May to August, which floods the paddies for rice. The dry season from December to February (1 to 3 mm a month) is when boats carry the harvest downriver and the cities trade."},
  {"name": "The Frostwardens (reindeer herders of the northern uplands)", "lat": 66.0, "lon": 130.0, "koppen": "ET", "reasons": "Tundra at 840 m, right on the polar circle. Even the warmest month reaches only 3.0 °C, well below the 10 °C tree-line threshold, so there is open grazing but no forest. Winters fall to -28.9 °C and the annual mean is -15.2 °C, so herds and heavy furs are what keep people alive. Only 163 mm of precipitation falls a year, so travel by sledge over thin snow is possible for most of the year."},
  {"name": "The Highmarch (pass-fortress and silver mines of the central mountains)", "lat": 46.5, "lon": 9.0, "koppen": "ET", "reasons": "High alpine ground at 1407 m in the mountain spine between the oceanic west and the inner sea. The warmest month is only 9.3 °C and the annual mean is -0.2 °C, so the passes lie under snow from November to March, when months fall to -9.4 °C. That gives a short summer campaigning season, after which the passes close themselves. Steady precipitation of 584 mm a year feeds glaciers and mine streams. Living off this ground takes hardy people and supplies brought up from the lowlands."},
  {"name": "The Tidewrights (Port Saltmere, capital of the sea republic)", "lat": 47.0, "lon": -2.0, "koppen": "Cfb", "reasons": "Sea-level Atlantic coast (1 m) with a southwest wind off the ocean. It is mild all year, ranging from 2.5 °C in January to 15.0 °C in July, and the coldest month stays above 0 °C, so the harbour never freezes. Rain is steady at 782 mm a year, peaking at 96.3 mm in October. That fits a damp, grey capital whose open harbour can run shipping all year."},
  {"name": "The Long Drought (fall of the Sheaf Dynasty's grain plains)", "lat": 50.0, "lon": 50.0, "koppen": "Dsb", "reasons": "Low, flat plains (1 m) with summers warm enough for grain, reaching 14.6 °C in July. But the driest month, June with 20.9 mm, comes right when the grain is ripening. Annual rain is only 576 mm, so a few seasons of failed early-summer rain would wither the harvest. Winters drop to -1.1 °C, below 0 °C, so there is no second growing season to make up the loss."},
  {"name": "The Burning of the Southern Archive (the Cape library city)", "lat": -33.9, "lon": 18.8, "koppen": "Csb", "reasons": "Southern cape near the sea (103 m) with mild weather. Temperatures run from 10.9 °C to 20.7 °C and the annual mean is 16.0 °C, which suits stored paper and parchment. But the climate is sharply seasonal. Winter storms bring up to 334.7 mm in May, while October gets only 10.8 mm. In the dry spring and summer the scrub and the city's stacks are tinder-dry, so an attack in that season would set the whole city burning."}
]
```

## Campaign hooks

- **Salt for grain:** As the Long Drought spread across the Sheaf Dynasty's plains, the Ashen Throne cornered the salt that was needed to preserve what grain was left. The Tidewrights shipped that salt north at ruinous prices. The players find a Tidewright ledger suggesting the republic held back grain ships until the dynasty fell. The surviving Sheaf heirs want that proof, and so does Port Saltmere's own council, which would prefer to destroy it.
- **The last copy:** The Southern Archive held the only record of how the Verdant League manages its monsoon floods: the sluice-gate tables that tell each city when to open its paddies. The Archive burned at the end of the dry season, when the city was tinder-dry. Rumour says one scholar fled north on a Tidewright ship with the tables. The party has to find them before the next flood season ruins the rice harvest.
- **The pass closes in November:** A Highmarch silver caravan has to cross before the snow shuts the passes. Ashen Throne envoys, Tidewright factors and a Frostwarden fur train are all travelling with it, and each has a reason to sabotage the others. If the party is still on the mountain when winter comes, they spend it snowed into a Highmarch fortress, with a murder to solve.
- **Furs for the desert court:** The Ashen Throne's oasis cities get cold at night, and its nobles pay huge sums for Frostwarden furs, which they treat as a status symbol. A Frostwarden clan that lost its herds in a brutal winter (-28.9 °C in January) has started selling sacred white pelts. The party must escort the shipment from the edge of the ice to the hot desert, or stop the trade before the clans go to war.
- **Ashes and drought:** Records rescued from the burnt Archive suggest the Long Drought was not just bad luck. They describe an old Highmarch ritual, or a dam on a mountain river, that cut off the early-summer rains on the plains. The players have to decide whether to tell the Sheaf heirs, which could set off a war with the Highmarch, or deal with it quietly before June comes again.
