"""Plain-text GM report. Pure: render(snapshot) -> str.

The format is fixed by golden files: tests/fixtures/report_pointy.txt and
tests/fixtures/report_calibrated.txt. Changing it means updating them and
recording why in LOG.md.
"""

_ORIENTATION_NAMES = {"pointy": "pointy-top", "flat": "flat-top"}


def _hexes(hexes):
    if not hexes:
        return "unavailable"
    return " ".join("(%d,%d)" % (q, r) for q, r in hexes)


def _grid_lines(g):
    """The grid line, plus an alert line when calibration has a problem."""
    if g["source"] == "tts_grid":
        t = g["tts_grid"]
        return ["Grid: TTS Grid (no calibration markers), %s (TTS type %d), "
                "hex step %.2f x %.2f units"
                % (_ORIENTATION_NAMES[t["orientation"]], t["type"],
                   t["size"]["x"], t["size"]["y"])], []
    if g["source"] == "unavailable":
        return ["Grid: none"], [
            "POSITIONS UNAVAILABLE: %s, and no valid calibration has been "
            "saved yet. Hexes and distances are left out rather than guessed."
            % g["calibration_error"]]
    cal = g["calibration"]
    detail = ("hex step %.2f units, rows at %.1f°, spacing mismatch %.1f%%"
              % (g["hex_step"], g["row_angle_deg"],
                 100 * cal["spacing_mismatch"]))
    if g["source"] == "calibration":
        return ["Grid: calibrated from 3 markers, " + detail], []
    return ["Grid: saved calibration from %s, %s" % (cal["saved_at"], detail)], [
        "CALIBRATION WARNING: %s. Using the last valid calibration."
        % g["calibration_error"]]


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


def _areas(title, items, lines):
    lines.append("%s (%d)" % (title, len(items)))
    if not items:
        lines.append("none")
    for item in items:
        lines.append("%s: %s" % (item["name"], _hexes(item["hexes"])))
        _details(item, lines)
    lines.append("")


def _motion_line(snapshot):
    by_guid = {u["guid"]: u for u in snapshot["units"]}
    moving = []
    for guid in snapshot["in_motion"]:
        u = by_guid[guid]
        moving.append("%s (%s)" % (u["name"], "held by %s" % u["held_by"]
                                   if u["held_by"] else "not resting"))
    return "IN MOTION: %s; positions may be mid-move." % ", ".join(moving)


def render(snapshot):
    g = snapshot["grid"]
    names = {u["guid"]: u["name"] for u in snapshot["units"]}
    grid_lines, alerts = _grid_lines(g)
    if snapshot["in_motion"]:
        alerts.append(_motion_line(snapshot))
    lines = [
        "LANCER BOARD  #%d  %s  schema %d"
        % (snapshot["seq"], snapshot["received_at"], snapshot["schema"]),
    ] + grid_lines + [
        "Hexes: (q,r) axial",
        "Range: nearest occupied hex to nearest occupied hex, adjacent = 1",
    ] + alerts + [
        "",
        "UNITS (%d)" % len(snapshot["units"]),
    ]
    if not snapshot["units"]:
        lines.append("none")
    for u in snapshot["units"]:
        s = u["stats"]
        lines.append("[%s] %s  Size %s%s  HP %s  Heat %s  Structure %s  "
                     "Conditions: %s"
                     % (u["side"], u["name"], _size(u["size"]),
                        "  FLYING" if u["flying"] else "",
                        _stat(s, "hp"), _stat(s, "heat"),
                        _stat(s, "structure"),
                        ", ".join(s["conditions"]) or "-"))
        lines.append("  hexes: " + _hexes(u["hexes"]))
        _details(u, lines)
    lines.append("")

    _areas("TERRAIN", snapshot["terrain"], lines)
    _areas("HAZARDS", snapshot["hazards"], lines)

    lines.append("OBJECTIVES (%d)" % len(snapshot["objectives"]))
    if not snapshot["objectives"]:
        lines.append("none")
    for obj in snapshot["objectives"]:
        lines.append("%s: %s" % (obj["name"], _hexes(obj["hexes"])))
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
        lines.append("unavailable" if g["source"] == "unavailable" else "none")
    for d in snapshot["distances"]:
        lines.append("%s - %s: %d" % (names[d["a"]], names[d["b"]],
                                      d["hexes"]))
    lines.append("")

    lines.append("WARNINGS (%d)" % len(snapshot["warnings"]))
    lines.extend(snapshot["warnings"] or ["none"])
    return "\n".join(lines) + "\n"
