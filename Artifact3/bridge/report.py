"""Plain-text GM report. Pure: render(snapshot) -> str.

The format is fixed by tests/fixtures/report_pointy.txt (golden file).
Changing it means updating that file and recording why in LOG.md.
"""

from bridge import hexgrid

_ORIENTATION_NAMES = {"pointy": "pointy-top", "flat": "flat-top"}
_LABEL_SCHEMES = {"pointy": "odd-r", "flat": "odd-q"}


def _grid(snapshot):
    g = snapshot["grid"]
    return hexgrid.Grid(g["orientation"], g["size"]["x"], g["size"]["y"],
                        g["offset"]["x"], g["offset"]["z"])


def _hexes(grid, hexes):
    return " ".join("(%d,%d)%s" % (q, r, hexgrid.label(grid, (q, r)))
                    for q, r in hexes)


def _size(size):
    return "1/2" if size == 0.5 else "%d" % size


def _stat(stats, key):
    stat = stats.get(key)
    if stat is None:
        return "-"
    if stat["max"] is None:
        return "%d" % stat["current"]
    return "%d/%d" % (stat["current"], stat["max"])


def _details(item, lines):
    if item.get("extra"):
        lines.append("  other: " + ", ".join(
            "%s %s" % (k, v) for k, v in sorted(item["extra"].items())))
    if item.get("notes"):
        lines.append("  notes: " + " / ".join(item["notes"]))


def _areas(title, items, grid, lines):
    lines.append("%s (%d)" % (title, len(items)))
    if not items:
        lines.append("none")
    for item in items:
        lines.append("%s: %s" % (item["name"], _hexes(grid, item["hexes"])))
        _details(item, lines)
    lines.append("")


def render(snapshot):
    grid = _grid(snapshot)
    g = snapshot["grid"]
    names = {u["guid"]: u["name"] for u in snapshot["units"]}
    lines = [
        "LANCER BOARD  #%d  %s  schema %d"
        % (snapshot["seq"], snapshot["received_at"], snapshot["schema"]),
        "Grid: hex, %s (TTS type %d), hex step %.2f x %.2f units"
        % (_ORIENTATION_NAMES[g["orientation"]], g["tts_type"],
           g["size"]["x"], g["size"]["y"]),
        "Hexes: (q,r) axial + cXrY label (%s column/row)"
        % _LABEL_SCHEMES[g["orientation"]],
        "Range: nearest occupied hex to nearest occupied hex, adjacent = 1",
        "",
        "UNITS (%d)" % len(snapshot["units"]),
    ]
    if not snapshot["units"]:
        lines.append("none")
    for u in snapshot["units"]:
        s = u["stats"]
        lines.append("[%s] %s  Size %s  HP %s  Heat %s  Structure %s  "
                     "Conditions: %s"
                     % (u["side"], u["name"], _size(u["size"]),
                        _stat(s, "hp"), _stat(s, "heat"),
                        _stat(s, "structure"),
                        ", ".join(s["conditions"]) or "-"))
        lines.append("  hexes: " + _hexes(grid, u["hexes"]))
        _details(u, lines)
    lines.append("")

    _areas("TERRAIN", snapshot["terrain"], grid, lines)
    _areas("HAZARDS", snapshot["hazards"], grid, lines)

    lines.append("OBJECTIVES (%d)" % len(snapshot["objectives"]))
    if not snapshot["objectives"]:
        lines.append("none")
    for obj in snapshot["objectives"]:
        lines.append("%s: %s" % (obj["name"], _hexes(grid, obj["hexes"])))
        inside = ", ".join("%s (%d/%d hexes)" % (names[z["guid"]],
                                                 z["hexes_inside"],
                                                 z["hexes_total"])
                           for z in obj["units_in_zone"])
        lines.append("  inside (any occupied hex in zone): "
                     + (inside or "none"))
        _details(obj, lines)
    lines.append("")

    lines.append("DISTANCES (opposing sides, hexes)")
    if not snapshot["distances"]:
        lines.append("none")
    for d in snapshot["distances"]:
        lines.append("%s - %s: %d" % (names[d["a"]], names[d["b"]],
                                      d["hexes"]))
    lines.append("")

    lines.append("WARNINGS (%d)" % len(snapshot["warnings"]))
    lines.extend(snapshot["warnings"] or ["none"])
    return "\n".join(lines) + "\n"
