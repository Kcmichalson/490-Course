"""World ↔ hex conversion, distances, footprints, calibration. Pure only.

Coordinates are axial (q, r) tuples. World positions are TTS units on the
table plane (X, Z); height (Y) is never used. Every grid is a Lattice: hex
(q, r) has its center at

  origin + q * q_vec + r * r_vec          (world X, Z)

The lattice comes from calibration markers (a painted grid, any rotation)
or, as a fallback, from TTS's built-in Grid settings (`tts_lattice`).
Nearness is measured in regular-hex units (one hex step = 1), so it doesn't
depend on the lattice's scale or rotation.

ASSUMPTION (verify in TTS, M2): Grid.sizeX/sizeY is the center-to-center
distance between neighboring hexes, and the offset is a hex center.
"""

import math
from typing import NamedTuple

SQRT3 = math.sqrt(3.0)

# Neighbor order is fixed so outputs are deterministic.
DIRECTIONS = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))


class Lattice(NamedTuple):
    origin_x: float
    origin_z: float
    q_x: float   # world vector from a hex center to its (q + 1) neighbor
    q_z: float
    r_x: float   # world vector from a hex center to its (r + 1) neighbor
    r_z: float


class Placement(NamedTuple):
    hexes: tuple          # sorted (q, r) tuples
    offset_error: float   # footprint centroid to mini position, in hex steps


class CalibrationError(ValueError):
    """Calibration markers don't describe a hex lattice."""


def tts_lattice(orientation, size_x, size_y, offset_x=0.0, offset_z=0.0):
    """Lattice for TTS's built-in hex grid: pointy-top rows run along X,
    flat-top columns run along Z."""
    if orientation == "pointy":
        return Lattice(offset_x, offset_z,
                       size_x, 0.0, size_x / 2.0, size_y * SQRT3 / 2.0)
    return Lattice(offset_x, offset_z,
                   size_x * SQRT3 / 2.0, size_y / 2.0, 0.0, size_y)


def _frac_axial(lat, x, z):
    """Fractional (q, r) of a world point (inverse of the lattice basis)."""
    dx, dz = x - lat.origin_x, z - lat.origin_z
    det = lat.q_x * lat.r_z - lat.q_z * lat.r_x
    return ((dx * lat.r_z - dz * lat.r_x) / det,
            (lat.q_x * dz - lat.q_z * dx) / det)


def _regular(q, r):
    """(q, r) in regular-hex units, where one hex step is 1."""
    return q + r / 2.0, r * SQRT3 / 2.0


# --- conversion ---

def axial_round(q, r):
    """Round fractional axial coordinates to the nearest hex (cube rounding)."""
    s = -q - r
    rq, rr, rs = round(q), round(r), round(s)
    dq, dr, ds = abs(rq - q), abs(rr - r), abs(rs - s)
    if dq > dr and dq > ds:
        rq = -rr - rs
    elif dr > ds:
        rr = -rq - rs
    return int(rq), int(rr)


def world_to_axial(lat, x, z):
    return axial_round(*_frac_axial(lat, x, z))


def axial_to_world(lat, hex_):
    """World (x, z) of a hex center."""
    q, r = hex_
    return (lat.origin_x + q * lat.q_x + r * lat.r_x,
            lat.origin_z + q * lat.q_z + r * lat.r_z)


def hex_step(lat):
    """World distance between neighboring hex centers (along q)."""
    return math.hypot(lat.q_x, lat.q_z)


def row_angle_deg(lat):
    """Angle of the q direction from world +X, in degrees."""
    return math.degrees(math.atan2(lat.q_z, lat.q_x))


# --- calibration ---

def lattice_from_markers(origin, a, hexes_a, b, hexes_b,
                         spacing_tolerance, angle_tolerance_deg):
    """Lattice from three markers on hex centers: `origin`, and `a` / `b`
    sitting `hexes_a` / `hexes_b` hexes away along two hex rows through it.

    Points are world (x, z). Rows 60° apart give q = a-row, r = b-row; rows
    120° apart give r = a-row + b-row (the row 60° from a). Returns
    (lattice, info); raises CalibrationError naming the problem.
    """
    ox, oz = origin
    ax, az = (a[0] - ox) / hexes_a, (a[1] - oz) / hexes_a
    bx, bz = (b[0] - ox) / hexes_b, (b[1] - oz) / hexes_b
    la, lb = math.hypot(ax, az), math.hypot(bx, bz)
    if la == 0.0 or lb == 0.0:
        raise CalibrationError("marker %s is on Origin" % ("A" if la == 0.0 else "B"))
    mismatch = abs(la - lb) / max(la, lb)
    if mismatch > spacing_tolerance:
        raise CalibrationError(
            "inconsistent spacing: A gives %.3f and B gives %.3f units per hex "
            "(%.1f%% apart); check Hexes or placement" % (la, lb, 100 * mismatch))
    cos = max(-1.0, min(1.0, (ax * bx + az * bz) / (la * lb)))
    between = math.degrees(math.acos(cos))
    if abs(between - 60.0) <= angle_tolerance_deg:
        rx, rz = bx, bz
    elif abs(between - 120.0) <= angle_tolerance_deg:
        rx, rz = ax + bx, az + bz
    else:
        raise CalibrationError(
            "A and B aren't on hex rows through Origin (%.1f° apart; expected "
            "60° or 120°)" % between)
    lat = Lattice(ox, oz, ax, az, rx, rz)
    return lat, {"angle_between_deg": between, "spacing_mismatch": mismatch}


# --- distance ---

def distance(a, b):
    dq, dr = a[0] - b[0], a[1] - b[1]
    return (abs(dq) + abs(dr) + abs(dq + dr)) // 2


def neighbors(hex_):
    return [(hex_[0] + dq, hex_[1] + dr) for dq, dr in DIRECTIONS]


def footprint_distance(hexes_a, hexes_b):
    # Range between units = nearest occupied hex to nearest occupied hex,
    # adjacent = 1 (SPEC §3; accepted by the user in LOG.md Session 1,
    # Prompt 7).
    return min(distance(a, b) for a in hexes_a for b in hexes_b)


# --- footprints (position only; rotation never matters) ---

def _centroid_error(lat, x, z, hexes):
    pts = [_regular(*h) for h in hexes]
    cu = sum(p[0] for p in pts) / len(pts)
    cv = sum(p[1] for p in pts) / len(pts)
    u, v = _regular(*_frac_axial(lat, x, z))
    return math.hypot(cu - u, cv - v)


def place_footprint(grid, x, z, shape):
    """Hex-centered footprint: `shape` offsets around the hex nearest (x, z).

    `shape` comes from constants.FOOTPRINTS (Size 1/2, 1, 3).
    """
    origin = world_to_axial(grid, x, z)
    hexes = tuple(sorted(((origin[0] + q, origin[1] + r) for q, r in shape),
                         key=sort_key))
    return Placement(hexes, _centroid_error(grid, x, z, [origin]))


def corner_footprint(grid, x, z, rings):
    """Corner-centered footprint (Size 2, 4): the 3 hex centers nearest
    (x, z), plus `rings` rings of every hex touching them.

    A corner is shared by exactly 3 hexes, so the corner the base sits on
    decides the triangle's point-up/point-down orientation. Turning the
    mini in place can't change it; moving it to another corner can.
    """
    triangle = nearest_hexes(grid, x, z, 3)
    hexes = set(triangle.hexes)
    for _ in range(rings):
        hexes |= {n for h in hexes for n in neighbors(h)}
    return Placement(tuple(sorted(hexes, key=sort_key)), triangle.offset_error)


def nearest_hexes(grid, x, z, count):
    """The `count` hexes whose centers are nearest (x, z).

    The 3 nearest centers are the triangle around the hex corner the base
    sits on. Ties break by row-major order.
    """
    fq, fr = _frac_axial(grid, x, z)
    u, v = _regular(fq, fr)
    center = axial_round(fq, fr)
    radius = 2
    candidates = [(center[0] + dq, center[1] + dr)
                  for dq in range(-radius, radius + 1)
                  for dr in range(-radius, radius + 1)
                  if distance((0, 0), (dq, dr)) <= radius]

    def key(h):
        hu, hv = _regular(*h)
        return ((hu - u) ** 2 + (hv - v) ** 2, sort_key(h))

    hexes = tuple(sorted(sorted(candidates, key=key)[:count], key=sort_key))
    return Placement(hexes, _centroid_error(grid, x, z, hexes))


def hexes_in_rect(grid, cx, cz, size_x, size_z):
    """Hexes whose centers lie inside an axis-aligned XZ rectangle.

    Used for terrain, hazard, and objective bounds. If no center is inside
    (a small token), returns the hex under the rectangle's center.
    """
    eps = 1e-9
    x0, x1 = cx - size_x / 2.0, cx + size_x / 2.0
    z0, z1 = cz - size_z / 2.0, cz + size_z / 2.0
    corners = [world_to_axial(grid, x, z) for x in (x0, x1) for z in (z0, z1)]
    qs = [c[0] for c in corners]
    rs = [c[1] for c in corners]
    span = max(max(qs) - min(qs), max(rs) - min(rs)) + 1
    found = []
    for q in range(min(qs) - span, max(qs) + span + 1):
        for r in range(min(rs) - span, max(rs) + span + 1):
            x, z = axial_to_world(grid, (q, r))
            if x0 - eps <= x <= x1 + eps and z0 - eps <= z <= z1 + eps:
                found.append((q, r))
    if not found:
        found.append(world_to_axial(grid, cx, cz))
    return tuple(sorted(found, key=sort_key))


# --- ordering ---

def sort_key(hex_):
    """Row-major order: by r, then q."""
    return hex_[1], hex_[0]
