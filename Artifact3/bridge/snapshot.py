"""Snapshot schema v2: payload validation, description parsing, building.

Pure functions: the caller passes in `received_at`, `seq`, the previous
snapshot (for motion timing), and the saved calibration (if any).
Top-level structure errors raise PayloadError (the server returns 400).
Problems with a single object skip that object and add a warning.
"""

import math
import re
from datetime import datetime

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
_POINT_NAMES = {"origin": "Origin", "a": "A", "b": "B"}
_TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"   # received_at, as written by server.py


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

def _split_marker_line(description):
    """(first non-blank line, the lines after it). Blank lines before the
    marker are allowed (Prompt 12)."""
    lines = description.splitlines()
    for i, line in enumerate(lines):
        if line.strip():
            return line, lines[i + 1:]
    return "", []


def parse_marker(description):
    """Return (kind or None, warning or None) from the first non-blank line."""
    first, _ = _split_marker_line(description)
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
    for line in _split_marker_line(description)[1]:
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
    if text.isdigit() and int(text) in C.SIZES:
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
    orientation = C.GRID_TYPE_ORIENTATION[gtype]
    offsets = {k: float(raw.get(k, 0.0)) for k in _GRID_OFFSETS}
    lattice = hexgrid.tts_lattice(orientation,
                                  float(raw["sizeX"]), float(raw["sizeY"]),
                                  offsets[C.GRID_OFFSET_X_FIELD],
                                  offsets[C.GRID_OFFSET_Z_FIELD])
    info = {"orientation": orientation, "type": gtype,
            "size": {"x": float(raw["sizeX"]), "y": float(raw["sizeY"])},
            "offsets": offsets}
    return lattice, info


def validate_payload(payload):
    """Check top-level structure; return the objects. Raises PayloadError.

    The TTS grid is checked later, and only if it's needed (no calibration
    markers at all).
    """
    if not isinstance(payload, dict):
        raise PayloadError("payload must be a JSON object")
    version = payload.get("payload_version")
    if version != C.PAYLOAD_VERSION or isinstance(version, bool):
        raise PayloadError("'payload_version' must be %d; got %r"
                           % (C.PAYLOAD_VERSION, version))
    objects = payload.get("objects")
    if not isinstance(objects, list):
        raise PayloadError("'objects' must be a list")
    return objects


# --- calibration ---

def _lattice_dict(lat):
    return {"origin": {"x": lat.origin_x, "z": lat.origin_z},
            "q": {"x": lat.q_x, "z": lat.q_z},
            "r": {"x": lat.r_x, "z": lat.r_z}}


def _lattice_from_dict(d):
    return hexgrid.Lattice(d["origin"]["x"], d["origin"]["z"],
                           d["q"]["x"], d["q"]["z"], d["r"]["x"], d["r"]["z"])


def _calibration_points(markers):
    """{point: marker} from (head, pairs) markers, or (None, problem)."""
    if len(markers) > len(C.CALIBRATION_POINTS):
        return None, "%d calibration markers; expected 3" % len(markers)
    found = {}
    for head, pairs in markers:
        point = pairs.get("point", "").strip().lower()
        if point not in C.CALIBRATION_POINTS:
            return None, ("'%s' has Point '%s'; expected Origin, A, or B"
                          % (head["name"], pairs.get("point", "")))
        if point in found:
            return None, "two markers have Point: %s" % _POINT_NAMES[point]
        marker = {"guid": head["guid"], "name": head["name"],
                  "x": head["position"]["x"], "z": head["position"]["z"]}
        if point != "origin":
            hexes = pairs.get("hexes", "").strip()
            if not hexes.isdigit() or int(hexes) <= 0:
                return None, ("'%s' (Point: %s) needs Hexes: a positive whole "
                              "number" % (head["name"], _POINT_NAMES[point]))
            marker["hexes"] = int(hexes)
        found[point] = marker
    missing = [_POINT_NAMES[p] for p in C.CALIBRATION_POINTS if p not in found]
    if missing:
        return None, "missing calibration marker: Point: %s" % ", ".join(missing)
    return found, None


def _stable(saved, found):
    """True if every marker is within tolerance of its saved position (with
    the same Hexes), so the saved calibration should be kept unchanged."""
    limit = C.CAL_MARKER_TOLERANCE_HEX * hexgrid.hex_step(
        _lattice_from_dict(saved["lattice"]))
    for point in C.CALIBRATION_POINTS:
        old, new = saved["markers"][point], found[point]
        if old.get("hexes") != new.get("hexes"):
            return False
        if math.hypot(new["x"] - old["x"], new["z"] - old["z"]) > limit:
            return False
    return True


def _derive_calibration(found, received_at):
    o, a, b = (found[p] for p in C.CALIBRATION_POINTS)
    lat, info = hexgrid.lattice_from_markers(
        (o["x"], o["z"]), (a["x"], a["z"]), a["hexes"],
        (b["x"], b["z"]), b["hexes"],
        C.CAL_SPACING_TOLERANCE, C.CAL_ANGLE_TOLERANCE_DEG)
    return {"markers": found, "lattice": _lattice_dict(lat),
            "angle_between_deg": info["angle_between_deg"],
            "spacing_mismatch": info["spacing_mismatch"],
            "saved_at": received_at}


def _choose_lattice(payload, markers, saved, received_at):
    """Pick the grid (user's rules, LOG.md Session 1, Prompt 16).

    No calibration markers at all → TTS Grid. Valid markers → that
    calibration (or the saved one, if every marker is within tolerance of
    it). Invalid markers → the saved calibration with a warning, or no
    positions at all if none was ever saved. Returns (lattice or None, info).
    """
    if not markers:
        if "grid" not in payload:
            raise PayloadError("missing 'grid' (and no calibration markers)")
        lattice, tts = parse_grid(payload["grid"])
        info = {"source": "tts_grid", "tts_grid": tts,
                "calibration": None, "calibration_error": None}
    else:
        found, error = _calibration_points(markers)
        calibration = None
        if error is None:
            if saved is not None and _stable(saved, found):
                calibration = saved
            else:
                try:
                    calibration = _derive_calibration(found, received_at)
                except hexgrid.CalibrationError as exc:
                    error = str(exc)
        if calibration is not None:
            source = "calibration"
        elif saved is not None:
            source, calibration = "saved_calibration", saved
        else:
            source = "unavailable"
        lattice = (_lattice_from_dict(calibration["lattice"])
                   if calibration else None)
        info = {"source": source, "tts_grid": None,
                "calibration": calibration, "calibration_error": error}
    info["lattice"] = _lattice_dict(lattice) if lattice else None
    info["hex_step"] = hexgrid.hex_step(lattice) if lattice else None
    info["row_angle_deg"] = hexgrid.row_angle_deg(lattice) if lattice else None
    return lattice, info


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


def _parse_time(text):
    try:
        return datetime.strptime(text, _TIME_FORMAT)
    except (TypeError, ValueError):
        return None


def _motion(obj, guid, previous_units, received_at):
    """(held_by, moving, in_motion_since) for a unit.

    Moving = held by a player or not resting. `in_motion_since` carries over
    from the previous snapshot while the unit stays in motion.
    """
    held = obj.get("held_by_color")
    held = held if isinstance(held, str) and held else None
    moving = held is not None or obj.get("resting", True) is False
    since = None
    if moving:
        prev = previous_units.get(guid) or {}
        since = prev.get("in_motion_since") or received_at
    return held, moving, since


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
    # Rotation is kept as raw data only; footprints depend on position alone.
    rotation = _vec3(obj.get("rotation"))
    rotation_y = rotation["y"] if rotation else 0.0
    pos = head["position"]
    hexes = []
    if grid is not None:   # None: positions unavailable (no calibration)
        if size in C.CORNER_RINGS:
            placed = hexgrid.corner_footprint(grid, pos["x"], pos["z"],
                                              C.CORNER_RINGS[size])
        else:
            placed = hexgrid.place_footprint(grid, pos["x"], pos["z"],
                                             C.FOOTPRINTS[size])
        if placed.offset_error > C.PLACEMENT_TOLERANCE_HEX:
            warnings.append("'%s' may be between hexes" % name)
        hexes = [list(h) for h in placed.hexes]
    stats, extra = _stats(pairs, warnings, name)
    # Flying is the condition "Flying", never inferred from height
    # (user's rule, LOG.md Session 1, Prompt 12).
    flying = any(c.lower() == "flying" for c in stats["conditions"])
    return {"guid": head["guid"], "name": name, "side": side, "size": size,
            "flying": flying, "hexes": hexes,
            "stats": stats, "extra": extra,
            "world": pos, "rotation_y": rotation_y}


def _build_area(grid, head, pairs, obj):
    pos = head["position"]
    bounds = obj.get("bounds")
    center = _vec3(bounds.get("center")) if isinstance(bounds, dict) else None
    size = _vec3(bounds.get("size")) if isinstance(bounds, dict) else None
    if grid is None:
        hexes = ()
    elif center and size:
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


def build_snapshot(payload, received_at, seq, previous=None,
                   saved_calibration=None):
    """Turn a raw TTS payload into a processed snapshot dict.

    `previous` is the last snapshot (or None), used only to time how long a
    unit has been in motion. `saved_calibration` is the last valid
    calibration record (snapshot["grid"]["calibration"]), or None.
    """
    objects = validate_payload(payload)
    warnings = []
    marked = []   # (kind, head, pairs, notes, obj)
    seen = set()
    for index, obj in enumerate(objects):
        head, problem = _object_header(index, obj)
        if head is None:
            if problem:
                warnings.append(problem)
            continue
        if head["guid"] in seen:
            warnings.append("duplicate guid '%s'; second skipped" % head["guid"])
            continue
        seen.add(head["guid"])
        pairs, notes, desc_warnings = parse_description(head["description"])
        warnings.extend("'%s' %s" % (head["name"], w) for w in desc_warnings)
        marked.append((head["kind"], head, pairs, notes, obj))

    markers = [(head, pairs) for kind, head, pairs, _, _ in marked
               if kind == "calibration"]
    grid, grid_info = _choose_lattice(payload, markers, saved_calibration,
                                      received_at)

    previous_units = {u["guid"]: u for u in (previous or {}).get("units", [])}
    now = _parse_time(received_at)
    groups = {kind: [] for kind in C.KINDS}
    in_motion = []
    for kind, head, pairs, notes, obj in marked:
        if kind == "calibration":
            continue
        if kind == "unit":
            item = _build_unit(grid, head, pairs, obj, warnings)
            if item is not None:
                held, moving, since = _motion(obj, head["guid"],
                                              previous_units, received_at)
                item.update({"held_by": held, "moving": moving,
                             "in_motion_since": since})
                start = _parse_time(since)
                # Only marked units hold back history, and for at most
                # MOTION_STALE_SECONDS (user's rule, Prompt 16).
                if moving and now and start and \
                        (now - start).total_seconds() > C.MOTION_STALE_SECONDS:
                    warnings.append(
                        "'%s' has been in motion for over %d s (%s); it no "
                        "longer holds back history"
                        % (head["name"], C.MOTION_STALE_SECONDS,
                           "held by %s" % held if held else "not resting"))
                elif moving:
                    in_motion.append(head["guid"])
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
            if _opposing(a, b) and a["hexes"] and b["hexes"]:
                distances.append({
                    "a": a["guid"], "b": b["guid"],
                    "hexes": hexgrid.footprint_distance(
                        [tuple(h) for h in a["hexes"]],
                        [tuple(h) for h in b["hexes"]])})

    return {
        "schema": C.SCHEMA_VERSION,
        "seq": seq,
        "received_at": received_at,
        "grid": grid_info,
        "in_motion": sorted(in_motion),
        "units": units,
        "terrain": groups["terrain"],
        "hazards": groups["hazard"],
        "objectives": groups["objective"],
        "distances": distances,
        "warnings": warnings,
    }


_UNIT_TRANSIENT = ("world", "rotation_y", "held_by", "moving",
                   "in_motion_since")


def _board_only(snapshot):
    board = {k: v for k, v in snapshot.items()
             if k not in ("received_at", "seq", "in_motion")}
    board["units"] = [{k: v for k, v in u.items() if k not in _UNIT_TRANSIENT}
                      for u in snapshot.get("units", [])]
    return board


def same_board(a, b):
    """True if two snapshots describe the same board. Ignores time, seq, raw
    world position/rotation (so physics jitter isn't a change), and
    held/moving state (picking a mini up and putting it back isn't one)."""
    if a is None or b is None:
        return False
    return _board_only(a) == _board_only(b)
