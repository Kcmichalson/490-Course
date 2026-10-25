"""Snapshot schema v1: payload validation, description parsing, building.

Pure functions: the caller passes in `received_at` and `seq`.
Top-level structure errors raise PayloadError (the server returns 400).
Problems with a single object skip that object and add a warning.
"""

import math
import re

from bridge import constants as C
from bridge import hexgrid

_MARKER_RE = re.compile(r"^%s\s*:\s*(.*?)\s*$" % C.MARKER_KEY, re.IGNORECASE)
# Split a line on commas only where a new "Key:" follows, so
# "Conditions: Impaired, Slowed" stays one value.
_PAIR_SPLIT_RE = re.compile(r",\s*(?=[A-Za-z][A-Za-z0-9 _-]*:)")
_STAT_RE = re.compile(r"^\s*(-?\d+)\s*(?:/\s*(-?\d+)\s*)?$")
_STAT_KEYS = ("hp", "heat", "structure")
_NO_CONDITIONS = ("", "-", "none")
_SIZE_WORDS = {"1/2": 0.5, "½": 0.5, "0.5": 0.5, ".5": 0.5}

_GRID_FIELDS = ("sizeX", "sizeY")
_GRID_OFFSETS = ("offsetX", "offsetY", "offsetZ")


class PayloadError(ValueError):
    """The payload can't be used at all (HTTP 400)."""


def _is_num(value):
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value))


def _vec3(value):
    if (isinstance(value, dict)
            and all(_is_num(value.get(k)) for k in ("x", "y", "z"))):
        return {k: float(value[k]) for k in ("x", "y", "z")}
    return None


# --- description ---

def parse_marker(description):
    """Return (kind or None, warning or None) from the first line."""
    first = description.splitlines()[0] if description else ""
    match = _MARKER_RE.match(first.strip())
    if not match:
        return None, None
    kind = match.group(1).lower()
    if kind in C.KINDS:
        return kind, None
    if not kind:
        return None, "has 'AIT:' with no kind"
    return None, "unknown AIT kind '%s'" % match.group(1)


def parse_description(description):
    """Parse the lines after the marker into ({key: value}, notes, warnings).

    Keys are lowercased with spaces collapsed. Lines without a colon are
    kept as notes. Provisional syntax until M2 (LOG.md, Session 1).
    """
    pairs, notes, warnings = {}, [], []
    for line in description.splitlines()[1:]:
        line = line.strip()
        if not line:
            continue
        if ":" not in line:
            notes.append(line)
            continue
        for part in _PAIR_SPLIT_RE.split(line):
            key, _, value = part.partition(":")
            key = " ".join(key.split()).lower()
            if not key:
                notes.append(part.strip())
                continue
            if key in pairs:
                warnings.append("duplicate key '%s'; last value used" % key)
            pairs[key] = value.strip()
    return pairs, notes, warnings


def parse_stat(value):
    """'8/12' → {'current': 8, 'max': 12}; '4' → {'current': 4, 'max': None}."""
    match = _STAT_RE.match(value)
    if not match:
        return None
    cur, mx = match.groups()
    return {"current": int(cur), "max": int(mx) if mx is not None else None}


def parse_size(value):
    text = value.strip().lower()
    if text in _SIZE_WORDS:
        return _SIZE_WORDS[text]
    if text.isdigit() and int(text) in C.FOOTPRINTS:
        return int(text)
    return None


def parse_conditions(value):
    if value.strip().lower() in _NO_CONDITIONS:
        return []
    return [c.strip() for c in value.split(",") if c.strip()]


# --- validation ---

def parse_grid(raw):
    if not isinstance(raw, dict):
        raise PayloadError("'grid' must be an object")
    gtype = raw.get("type")
    if not isinstance(gtype, int) or isinstance(gtype, bool):
        raise PayloadError("'grid.type' must be an integer")
    if gtype not in C.GRID_TYPE_ORIENTATION:
        raise PayloadError("grid must be hex; got Grid.type %d" % gtype)
    for field in _GRID_FIELDS:
        if not _is_num(raw.get(field)) or raw[field] <= 0:
            raise PayloadError("'grid.%s' must be a positive number" % field)
    for field in _GRID_OFFSETS:
        if field in raw and not _is_num(raw[field]):
            raise PayloadError("'grid.%s' must be a number" % field)
    return hexgrid.Grid(C.GRID_TYPE_ORIENTATION[gtype],
                        float(raw["sizeX"]), float(raw["sizeY"]),
                        float(raw.get("offsetX", 0.0)),
                        float(raw.get("offsetZ", 0.0)))


def validate_payload(payload):
    """Check top-level structure; return (grid, objects). Raises PayloadError."""
    if not isinstance(payload, dict):
        raise PayloadError("payload must be a JSON object")
    version = payload.get("payload_version")
    if version != C.PAYLOAD_VERSION or isinstance(version, bool):
        raise PayloadError("'payload_version' must be %d; got %r"
                           % (C.PAYLOAD_VERSION, version))
    if "grid" not in payload:
        raise PayloadError("missing 'grid'")
    grid = parse_grid(payload["grid"])
    objects = payload.get("objects")
    if not isinstance(objects, list):
        raise PayloadError("'objects' must be a list")
    return grid, objects


# --- building ---

def _object_header(index, obj):
    """Common fields of a marked object, or (None, warning or None).

    Unmarked objects return (None, None): they're ignored silently.
    """
    if not isinstance(obj, dict):
        return None, "object #%d is not an object; skipped" % index
    desc = obj.get("description", "")
    if not isinstance(desc, str):
        return None, "object #%d description is not text; skipped" % index
    kind, problem = parse_marker(desc)
    guid, name = obj.get("guid"), obj.get("name")
    label = name if isinstance(name, str) and name else "object #%d" % index
    if kind is None:
        return None, ("'%s' %s; skipped" % (label, problem)) if problem else None
    if not isinstance(guid, str) or not guid:
        return None, "'%s' has no guid; skipped" % label
    position = _vec3(obj.get("position"))
    if position is None:
        return None, "'%s' has no valid position; skipped" % label
    return {"kind": kind, "guid": guid,
            "name": name if isinstance(name, str) and name else guid,
            "description": desc, "position": position}, None


def _stats(pairs, warnings, name):
    stats, extra = {}, {}
    for key, value in pairs.items():
        if key in _STAT_KEYS:
            stat = parse_stat(value)
            if stat is None:
                warnings.append("'%s' %s '%s' is not a number; kept as text"
                                % (name, key, value))
                extra[key] = value
            else:
                stats[key] = stat
        elif key == "conditions":
            stats["conditions"] = parse_conditions(value)
        elif key not in ("size", "side"):
            extra[key] = value
    stats.setdefault("conditions", [])
    return stats, extra


def _build_unit(grid, head, pairs, obj, warnings):
    name = head["name"]
    if "size" in pairs:
        size = parse_size(pairs["size"])
        if size is None:
            warnings.append("'%s' has unsupported Size '%s'; skipped"
                            % (name, pairs["size"]))
            return None
    else:
        size = C.DEFAULT_SIZE
        warnings.append("'%s' has no Size; using %s" % (name, size))
    side = pairs.get("side", "").strip().lower()
    if not side:
        side = C.SIDE_UNKNOWN
        warnings.append("'%s' has no Side; using %s" % (name, side))
    rotation = _vec3(obj.get("rotation"))
    rotation_y = rotation["y"] if rotation else 0.0
    shape = C.FOOTPRINTS[size]
    steps, rot_error = 0, 0.0
    if not hexgrid.is_rotation_symmetric(shape):
        steps, rot_error = hexgrid.rotation_steps(
            rotation_y, C.ROTATION_STEP_DEG, C.ROTATION_OFFSET_DEG,
            C.ROTATION_SIGN)
        if abs(rot_error) > C.ROTATION_TOLERANCE_DEG:
            warnings.append("'%s' rotation %.0f° is between 60° steps"
                            % (name, rotation_y))
    pos = head["position"]
    placed = hexgrid.place_footprint(grid, pos["x"], pos["z"], shape, steps)
    if placed.offset_error > C.PLACEMENT_TOLERANCE_HEX:
        warnings.append("'%s' may be between hexes" % name)
    stats, extra = _stats(pairs, warnings, name)
    return {"guid": head["guid"], "name": name, "side": side, "size": size,
            "hexes": [list(h) for h in placed.hexes],
            "rotation_steps": placed.rotation_steps,
            "stats": stats, "extra": extra,
            "world": pos, "rotation_y": rotation_y}


def _build_area(grid, head, pairs, obj):
    pos = head["position"]
    bounds = obj.get("bounds")
    center = _vec3(bounds.get("center")) if isinstance(bounds, dict) else None
    size = _vec3(bounds.get("size")) if isinstance(bounds, dict) else None
    if center and size:
        hexes = hexgrid.hexes_in_rect(grid, center["x"], center["z"],
                                      size["x"], size["z"])
    else:
        hexes = (hexgrid.world_to_axial(grid, pos["x"], pos["z"]),)
    return {"guid": head["guid"], "name": head["name"],
            "hexes": [list(h) for h in hexes], "extra": dict(pairs)}


def _side_key(side):
    if side in C.SIDE_ORDER:
        return (0, C.SIDE_ORDER.index(side), "")
    if side == C.SIDE_UNKNOWN:
        return (2, 0, "")
    return (1, 0, side)


def _opposing(a, b):
    return (a["side"] != b["side"] or a["side"] == C.SIDE_UNKNOWN)


def build_snapshot(payload, received_at, seq):
    """Turn a raw TTS payload into a processed snapshot dict."""
    grid, objects = validate_payload(payload)
    warnings = []
    groups = {kind: [] for kind in C.KINDS}
    seen = set()
    for index, obj in enumerate(objects):
        head, problem = _object_header(index, obj)
        if head is None:
            if problem:
                warnings.append(problem)
            continue
        kind = head["kind"]
        if head["guid"] in seen:
            warnings.append("duplicate guid '%s'; second skipped" % head["guid"])
            continue
        seen.add(head["guid"])
        pairs, notes, desc_warnings = parse_description(head["description"])
        warnings.extend("'%s' %s" % (head["name"], w) for w in desc_warnings)
        if kind == "unit":
            item = _build_unit(grid, head, pairs, obj, warnings)
        else:
            item = _build_area(grid, head, pairs, obj)
        if item is not None:
            item["notes"] = notes
            groups[kind].append(item)

    units = sorted(groups["unit"],
                   key=lambda u: (_side_key(u["side"]), u["name"], u["guid"]))
    for kind in ("terrain", "hazard", "objective"):
        groups[kind].sort(key=lambda a: (a["name"], a["guid"]))

    for objective in groups["objective"]:
        # A unit is inside the objective if any of its occupied hexes is in
        # the zone (user's rule, LOG.md Session 1, Prompt 7).
        zone = set(map(tuple, objective["hexes"]))
        objective["units_in_zone"] = [
            {"guid": u["guid"],
             "hexes_inside": sum(1 for h in u["hexes"] if tuple(h) in zone),
             "hexes_total": len(u["hexes"])}
            for u in units if any(tuple(h) in zone for h in u["hexes"])]

    distances = []
    for i, a in enumerate(units):
        for b in units[i + 1:]:
            if _opposing(a, b):
                distances.append({
                    "a": a["guid"], "b": b["guid"],
                    "hexes": hexgrid.footprint_distance(
                        [tuple(h) for h in a["hexes"]],
                        [tuple(h) for h in b["hexes"]])})

    raw_grid = payload["grid"]
    return {
        "schema": C.SCHEMA_VERSION,
        "seq": seq,
        "received_at": received_at,
        "grid": {"orientation": grid.orientation,
                 "tts_type": raw_grid["type"],
                 "size": {"x": grid.size_x, "y": grid.size_y},
                 "offset": {"x": grid.offset_x,
                            "y": float(raw_grid.get("offsetY", 0.0)),
                            "z": grid.offset_z}},
        "units": units,
        "terrain": groups["terrain"],
        "hazards": groups["hazard"],
        "objectives": groups["objective"],
        "distances": distances,
        "warnings": warnings,
    }


def _board_only(snapshot):
    board = {k: v for k, v in snapshot.items()
             if k not in ("received_at", "seq")}
    board["units"] = [{k: v for k, v in u.items()
                       if k not in ("world", "rotation_y")}
                      for u in snapshot.get("units", [])]
    return board


def same_board(a, b):
    """True if two snapshots describe the same board (ignores time, seq, and
    raw world position/rotation, so physics jitter isn't a change)."""
    if a is None or b is None:
        return False
    return _board_only(a) == _board_only(b)
