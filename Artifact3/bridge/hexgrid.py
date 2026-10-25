"""World ↔ hex conversion, distances, and footprints. Pure functions only.

Coordinates are axial (q, r) tuples. World positions are TTS units on the
table plane (X, Z). Conversion first normalizes world offsets by the grid's
size so one hex step is 1 "unit", then applies the standard axial formulas:

  pointy-top (rows run along X):    u = q + r/2      v = r * sqrt(3)/2
  flat-top   (columns run along Z): u = q * sqrt(3)/2  v = r + q/2

ASSUMPTION (verify in TTS, M2): Grid.sizeX/sizeY is the center-to-center
distance between neighboring hexes, and offsetX/offsetZ is a hex center.
"""

import math
from typing import NamedTuple

SQRT3 = math.sqrt(3.0)

# Neighbor order is fixed so outputs are deterministic.
DIRECTIONS = ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1))


class Grid(NamedTuple):
    orientation: str   # "pointy" or "flat"
    size_x: float
    size_y: float
    offset_x: float = 0.0
    offset_z: float = 0.0


class Placement(NamedTuple):
    hexes: tuple          # sorted (q, r) tuples
    offset_error: float   # footprint centroid to mini position, in hex steps


# --- unit space (one hex step = 1) ---

def _world_to_unit(grid, x, z):
    return (x - grid.offset_x) / grid.size_x, (z - grid.offset_z) / grid.size_y


def _unit_to_world(grid, u, v):
    return u * grid.size_x + grid.offset_x, v * grid.size_y + grid.offset_z


def _axial_to_unit(orientation, q, r):
    if orientation == "pointy":
        return q + r / 2.0, r * SQRT3 / 2.0
    return q * SQRT3 / 2.0, r + q / 2.0


def _unit_to_axial(orientation, u, v):
    if orientation == "pointy":
        r = 2.0 * v / SQRT3
        return u - r / 2.0, r
    q = 2.0 * u / SQRT3
    return q, v - q / 2.0


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


def world_to_axial(grid, x, z):
    u, v = _world_to_unit(grid, x, z)
    return axial_round(*_unit_to_axial(grid.orientation, u, v))


def axial_to_world(grid, hex_):
    """World (x, z) of a hex center."""
    return _unit_to_world(grid, *_axial_to_unit(grid.orientation, *hex_))


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

def _centroid_error(grid, x, z, hexes):
    units = [_axial_to_unit(grid.orientation, *h) for h in hexes]
    cu = sum(p[0] for p in units) / len(units)
    cv = sum(p[1] for p in units) / len(units)
    u, v = _world_to_unit(grid, x, z)
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
    u, v = _world_to_unit(grid, x, z)
    center = axial_round(*_unit_to_axial(grid.orientation, u, v))
    radius = 2
    candidates = [(center[0] + dq, center[1] + dr)
                  for dq in range(-radius, radius + 1)
                  for dr in range(-radius, radius + 1)
                  if distance((0, 0), (dq, dr)) <= radius]

    def key(h):
        hu, hv = _axial_to_unit(grid.orientation, *h)
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
