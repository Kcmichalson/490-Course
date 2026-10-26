"""Map query tool (map-wide companion): read-only questions about a map
exported with the app's File > Export Map Data (fcm-map-data-*.bin.gz).

By hand:
    py tools/mapquery.py point    DATA LAT LON
    py tools/mapquery.py region   DATA SOUTH NORTH WEST EAST
    py tools/mapquery.py overview DATA
As a stdio MCP server (for claude -p; tools point, region, overview):
    py tools/mapquery.py serve DATA [--log CALLS.jsonl]

Read-only: it only reads DATA (and appends to the --log file). Answers are
JSON. Standard library only.
"""

import argparse
import array
import datetime
import gzip
import json
import math
import sys
from collections import deque

MAGIC = b"FCMGRID1"
TYPECODES = {"uint8": "B", "int16": "h", "uint16": "H"}
KOPPEN_WATER = 255
LAND_CATEGORIES = {"Land", "Land ice"}               # a placement may stand here
CONNECTED_CATEGORIES = {"Land", "Land ice", "Lake"}  # one landmass (lakes inside it)
MOUNTAIN_MIN_M = 1500
MOUNTAIN_MIN_KM2 = 20000
COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]


def r1(v):
    return round(v, 1) + 0.0  # + 0.0: no -0.0


class MapData:
    """The decoded grid: header fields plus one array per layer (stored
    integers; .value() applies the layer's scale)."""

    def __init__(self, raw):
        if raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        magic_end = raw.index(b"\n")
        if raw[:magic_end] != MAGIC:
            raise ValueError("not an FCM map data file (File > Export Map Data)")
        head_end = raw.index(b"\n", magic_end + 1)
        self.header = h = json.loads(raw[magic_end + 1:head_end].decode("utf-8"))
        self.w, self.h = h["width"], h["height"]
        n = self.w * self.h
        data = memoryview(raw)[head_end + 1:]
        self.layers, self.scale = {}, {}
        for layer in h["layers"]:
            a = array.array(TYPECODES[layer["type"]])
            a.frombytes(data[layer["offset"]:layer["offset"] + n * a.itemsize])
            if sys.byteorder == "big":
                a.byteswap()
            self.layers[layer["name"]] = a
            self.scale[layer["name"]] = layer["scale"]
        self.months = h["months"]
        self._monthly = {p: [(self.layers[f"{p}_{m.lower()}"], self.scale[f"{p}_{m.lower()}"]) for m in self.months]
                         for p in ("temp", "rain")}
        self.categories = h["categories"]
        self.codes = h["koppen_codes"]
        self.names = h.get("koppen_names", {})

    @classmethod
    def load(cls, path):
        with open(path, "rb") as f:
            return cls(f.read())

    def value(self, name, k):
        return self.layers[name][k] * self.scale[name]

    # ---- geometry (cell-registered rows, as src/sim/coords.js) ----

    def cell_of(self, lat, lon):
        """(i, j) of the cell holding lat/lon, or None outside the map."""
        h = self.header
        span = h["lat_top"] - h["lat_bottom"]
        if not (h["lat_bottom"] <= lat <= h["lat_top"]):
            return None
        d = (lon - h["lon_west"]) % 360
        if d >= h["lon_span"]:
            if not h["wraps"]:
                return None
            d = 0.0
        j = min(self.h - 1, int((h["lat_top"] - lat) / span * self.h))
        i = min(self.w - 1, int(d / h["lon_span"] * self.w))
        return i, j

    def center(self, i, j):
        h = self.header
        lat = h["lat_top"] - (j + 0.5) / self.h * (h["lat_top"] - h["lat_bottom"])
        lon = h["lon_west"] + (i + 0.5) / self.w * h["lon_span"]
        lon = (lon + 180) % 360 - 180
        return lat, lon

    def cell_area_km2(self, j):
        """Area of one cell in row j (spherical, the map's planet radius)."""
        h = self.header
        R = h.get("radius_km", 6371)
        span = h["lat_top"] - h["lat_bottom"]
        north = math.radians(h["lat_top"] - j / self.h * span)
        south = math.radians(h["lat_top"] - (j + 1) / self.h * span)
        dlon = math.radians(h["lon_span"] / self.w)
        return R * R * dlon * abs(math.sin(north) - math.sin(south))

    # ---- per-cell facts ----

    def category(self, k):
        return self.categories[self.layers["category"][k]]

    def koppen(self, k):
        c = self.layers["koppen"][k]
        return None if c == KOPPEN_WATER else self.codes[c]

    def monthly(self, prefix, k):
        return [a[k] * s for a, s in self._monthly[prefix]]


def lon_extent(columns, d):
    """West and east longitude of a set of used columns, across the date
    line when the map wraps: the extent is everything but the widest gap."""
    cols = sorted(columns)
    if len(cols) == d.w:
        return {"west": -180.0, "east": 180.0, "all_longitudes": True}
    start, end = cols[0], cols[-1]
    if d.header["wraps"]:
        best_gap = -1
        for a, b in list(zip(cols, cols[1:])) + [(cols[-1], cols[0] + d.w)]:
            if b - a - 1 > best_gap:
                best_gap, start, end = b - a - 1, b % d.w, a  # the extent runs from after the gap to before it
    half = d.header["lon_span"] / d.w / 2
    return {"west": r1(d.center(start, 0)[1] - half), "east": r1(d.center(end, 0)[1] + half)}


def point(d, lat, lon):
    """Everything the map knows at one place (the cell holding lat/lon)."""
    cell = d.cell_of(lat, lon)
    if cell is None:
        raise ValueError(f"{lat}, {lon} is outside the map")
    i, j = cell
    k = j * d.w + i
    clat, clon = d.center(i, j)
    temps = [r1(t) for t in d.monthly("temp", k)]
    rain = [r1(p) for p in d.monthly("rain", k)]
    u, v = d.value("wind_u", k), d.value("wind_v", k)
    frm = (math.degrees(math.atan2(-u, -v)) + 360) % 360
    code = d.koppen(k)
    return {
        "query": {"lat": lat, "lon": lon},
        "cell": {"i": i, "j": j, "center_lat": r1(clat), "center_lon": r1(clon), "area_km2": round(d.cell_area_km2(j))},
        "category": d.category(k),
        "is_land": d.category(k) in LAND_CATEGORIES,
        "elevation_m": int(d.value("elevation", k)),
        "koppen": {"code": code, "name": d.names.get(code, "")} if code else None,
        "temperature_c": {"monthly": temps, "warmest": max(temps), "coldest": min(temps), "annual_mean": r1(sum(temps) / 12)},
        "precipitation_mm": {"monthly": rain, "annual": round(sum(rain))},
        "wind": {"from_deg": round(frm) % 360, "from_compass": COMPASS[round(frm / 22.5) % 16], "speed": round(math.hypot(u, v), 2),
                 "season": d.header.get("wind_season")},
        "months": d.months,
    }


def _top_koppen(weights, total, n=6):
    out = sorted(weights.items(), key=lambda kv: -kv[1])
    return [{"code": c, "name": "", "percent_of_land": r1(100 * a / total)} for c, a in out[:n]] if total else []


def region(d, south, north, west, east):
    """Summary of the cells whose centers lie in the box (west > east means
    the box crosses the date line)."""
    if south > north:
        raise ValueError("south must be at most north")
    width = (east - west) % 360 or (360 if east != west else 0)
    total = land = rain_sum = temp_sum = 0.0
    cells = 0
    kop = {}
    elev_min = elev_max = None
    for j in range(d.h):
        lat = d.center(0, j)[0]
        if not (south <= lat <= north):
            continue
        area = d.cell_area_km2(j)
        for i in range(d.w):
            lon = d.center(i, j)[1]
            if (lon - west) % 360 > width:
                continue
            k = j * d.w + i
            cells += 1
            total += area
            if d.category(k) not in LAND_CATEGORIES:
                continue
            land += area
            e = d.value("elevation", k)
            elev_min = e if elev_min is None else min(elev_min, e)
            elev_max = e if elev_max is None else max(elev_max, e)
            rain_sum += area * sum(d.monthly("rain", k))
            temp_sum += area * sum(d.monthly("temp", k)) / 12
            code = d.koppen(k)
            if code:
                kop[code] = kop.get(code, 0.0) + area
    if not cells:
        raise ValueError("no cell centers in that box")
    top = _top_koppen(kop, land)
    for t in top:
        t["name"] = d.names.get(t["code"], "")
    return {
        "query": {"south": south, "north": north, "west": west, "east": east},
        "cells": cells,
        "area_km2": round(total),
        "land_share_percent": r1(100 * land / total),
        "land_area_km2": round(land),
        "main_koppen": top,
        "land_elevation_m": {"min": int(elev_min), "max": int(elev_max)} if land else None,
        "land_mean_annual_rain_mm": round(rain_sum / land) if land else None,
        "land_mean_temperature_c": r1(temp_sum / land) if land else None,
    }


def _components(d, member):
    """Connected cell sets (8-neighbour; east-west wrap when the map wraps)."""
    seen = bytearray(d.w * d.h)
    wraps = d.header["wraps"]
    for k0 in range(d.w * d.h):
        if seen[k0] or not member(k0):
            continue
        seen[k0] = 1
        comp, queue = [], deque([k0])
        while queue:
            k = queue.popleft()
            comp.append(k)
            j, i = divmod(k, d.w)
            for dj in (-1, 0, 1):
                jj = j + dj
                if not 0 <= jj < d.h:
                    continue
                for di in (-1, 0, 1):
                    ii = i + di
                    if wraps:
                        ii %= d.w
                    elif not 0 <= ii < d.w:
                        continue
                    kk = jj * d.w + ii
                    if not seen[kk] and member(kk):
                        seen[kk] = 1
                        queue.append(kk)
        yield comp


def _describe(d, comp):
    area = 0.0
    lats, cols, kop = [], set(), {}
    peak, peak_k = None, None
    for k in comp:
        j, i = divmod(k, d.w)
        a = d.cell_area_km2(j)
        area += a
        lats.append(d.center(i, j)[0])
        cols.add(i)
        code = d.koppen(k)
        if code:
            kop[code] = kop.get(code, 0.0) + a
        e = d.value("elevation", k)
        if peak is None or e > peak:
            peak, peak_k = e, k
    half = (d.header["lat_top"] - d.header["lat_bottom"]) / d.h / 2
    pj, pi = divmod(peak_k, d.w)
    plat, plon = d.center(pi, pj)
    return area, {
        "area_km2": round(area),
        "extent": {"south": r1(min(lats) - half), "north": r1(max(lats) + half), **lon_extent(cols, d)},
        "peak": {"elevation_m": int(peak), "lat": r1(plat), "lon": r1(plon)},
        "_kop": kop,
    }


def overview(d, top=12):
    """Landmasses (largest first) with extent, area, and main climates;
    mountain ranges (≥ 1,500 m, ≥ 20,000 km²) with extent and peak."""
    cat = d.layers["category"]
    connected = {d.categories.index(c) for c in CONNECTED_CATEGORIES if c in d.categories}
    lands = []
    for comp in _components(d, lambda k: cat[k] in connected):
        area, info = _describe(d, comp)
        kop = info.pop("_kop")
        land = sum(kop.values())
        info["main_koppen"] = [{"code": c, "name": d.names.get(c, ""), "percent_of_land": r1(100 * a / land)}
                               for c, a in sorted(kop.items(), key=lambda kv: -kv[1])[:4]] if land else []
        lands.append((area, info))
    lands.sort(key=lambda t: -t[0])
    elev = d.layers["elevation"]
    ranges = []
    for comp in _components(d, lambda k: cat[k] in connected and elev[k] * d.scale["elevation"] >= MOUNTAIN_MIN_M):
        area, info = _describe(d, comp)
        info.pop("_kop")
        if area >= MOUNTAIN_MIN_KM2:
            ranges.append((area, info))
    ranges.sort(key=lambda t: -t[0])
    total_land = sum(a for a, _ in lands)
    return {
        "map": {k: d.header[k] for k in ("width", "height", "lat_top", "lat_bottom", "lon_west", "lon_span", "wraps", "radius_km")
                if k in d.header},
        "landmass_count": len(lands),
        "land_area_km2": round(total_land),
        "landmasses": [{"rank": n + 1, **info} for n, (_, info) in enumerate(lands[:top])],
        "smaller_landmasses": {"count": max(0, len(lands) - top), "area_km2": round(sum(a for a, _ in lands[top:]))},
        "mountain_ranges": [{"rank": n + 1, **info} for n, (_, info) in enumerate(ranges[:top])],
        "mountain_rule": f"connected land at or above {MOUNTAIN_MIN_M} m covering at least {MOUNTAIN_MIN_KM2:,} km²",
    }


# ---------- MCP server (stdio, newline-delimited JSON-RPC 2.0) ----------

TOOLS = [
    {"name": "point", "description": "Climate and terrain of the map at one latitude/longitude: category, is_land, "
     "elevation, Köppen code, 12 monthly temperatures (°C) and rain (mm), wind.",
     "inputSchema": {"type": "object", "properties": {"lat": {"type": "number"}, "lon": {"type": "number"}},
                     "required": ["lat", "lon"]}},
    {"name": "region", "description": "Summary of a lat/lon box: land share, main Köppen classes (% of land), land "
     "elevation range, mean annual rain over land. west > east crosses the date line.",
     "inputSchema": {"type": "object", "properties": {k: {"type": "number"} for k in ("south", "north", "west", "east")},
                     "required": ["south", "north", "west", "east"]}},
    {"name": "overview", "description": "The whole map: landmasses (extent, area, main climates) and major mountain "
     "ranges (extent, peak).", "inputSchema": {"type": "object", "properties": {}}},
]


def call_tool(d, name, args, cache):
    if name == "point":
        return point(d, float(args["lat"]), float(args["lon"]))
    if name == "region":
        return region(d, *(float(args[k]) for k in ("south", "north", "west", "east")))
    if name == "overview":
        if "overview" not in cache:
            cache["overview"] = overview(d)
        return cache["overview"]
    raise ValueError(f"unknown tool {name!r}")


def serve(d, log_path=None, stdin=None, stdout=None):
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    cache = {}

    def send(obj):
        stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
        stdout.flush()

    for line in stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "parse error"}})
            continue
        mid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
        if mid is None:
            continue  # notifications (notifications/initialized, cancelled) need no reply
        if method == "initialize":
            send({"jsonrpc": "2.0", "id": mid, "result": {
                "protocolVersion": params.get("protocolVersion", "2024-11-05"),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "fcm-mapquery", "version": "1"}}})
        elif method == "ping":
            send({"jsonrpc": "2.0", "id": mid, "result": {}})
        elif method == "tools/list":
            send({"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}})
        elif method == "tools/call":
            name, args = params.get("name"), params.get("arguments") or {}
            try:
                text, ok = json.dumps(call_tool(d, name, args, cache), ensure_ascii=False), True
            except (ValueError, KeyError, TypeError) as e:
                text, ok = f"error: {e}", False
            if log_path:
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(json.dumps({"ts": datetime.datetime.now().isoformat(timespec="seconds"), "tool": name,
                                        "arguments": args, "ok": ok}, ensure_ascii=False) + "\n")
            send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}], "isError": not ok}})
        else:
            send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"method not found: {method}"}})


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except AttributeError:
            pass
    ap = argparse.ArgumentParser(description="Read-only queries over an FCM map data file.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("point", help="one place")
    p.add_argument("data")
    p.add_argument("lat", type=float)
    p.add_argument("lon", type=float)
    r = sub.add_parser("region", help="a lat/lon box")
    r.add_argument("data")
    for k in ("south", "north", "west", "east"):
        r.add_argument(k, type=float)
    o = sub.add_parser("overview", help="landmasses and mountain ranges")
    o.add_argument("data")
    s = sub.add_parser("serve", help="stdio MCP server")
    s.add_argument("data")
    s.add_argument("--log", help="append each tool call to this JSONL file")
    args = ap.parse_args(argv)
    try:
        d = MapData.load(args.data)
        if args.cmd == "serve":
            serve(d, args.log)
            return 0
        if args.cmd == "point":
            out = point(d, args.lat, args.lon)
        elif args.cmd == "region":
            out = region(d, args.south, args.north, args.west, args.east)
        else:
            out = overview(d)
    except (OSError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
