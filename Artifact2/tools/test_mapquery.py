"""Tests for tools/mapquery.py on small synthetic maps (no model).

Run from Artifact2/:  py -B -m unittest tools/test_mapquery.py
"""

import gzip
import io
import json
import os
import pathlib
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mapquery  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
CODES = ["Af", "Am", "Aw", "BWh", "BWk", "BSh", "BSk", "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc", "Cfa", "Cfb", "Cfc",
         "Dsa", "Dsb", "Dsc", "Dsd", "Dwa", "Dwb", "Dwc", "Dwd", "Dfa", "Dfb", "Dfc", "Dfd", "ET", "EF", "H"]
CATS = ["Ocean", "Land", "Lake", "Land ice", "Sea ice"]
# The layer list of src/io/mapdata.js MAP_DATA_LAYERS.
LAYERS = ([("elevation", "int16", 1), ("category", "uint8", 1), ("koppen", "uint8", 1)]
          + [(f"temp_{m.lower()}", "int16", 0.1) for m in MONTHS]
          + [(f"rain_{m.lower()}", "uint16", 0.1) for m in MONTHS]
          + [("wind_u", "int16", 0.001), ("wind_v", "int16", 0.001)])
FMT = {"uint8": "B", "int16": "h", "uint16": "H"}


def write_map(path, w, h, values, **extent):
    """The app's file layout, written from Python (a test double of
    encodeMapData)."""
    header = {"format": "fcm-map-data", "version": 1, "width": w, "height": h, "lat_top": 90, "lat_bottom": -90,
              "lon_west": -180, "lon_span": 360, "wraps": True, "radius_km": 6371, "wind_season": "Annual Mean",
              "categories": CATS, "koppen_codes": CODES, "koppen_names": {"Af": "tropical rainforest"}, "months": MONTHS}
    header.update(extent)
    layers, offset, body = [], 0, b""
    for name, typ, scale in LAYERS:
        layers.append({"name": name, "type": typ, "scale": scale, "offset": offset})
        vals = [round(v / scale) for v in values[name]]
        chunk = struct.pack(f"<{w * h}{FMT[typ]}", *vals)
        offset += len(chunk)
        body += chunk
    header["layers"] = layers
    raw = b"FCMGRID1\n" + json.dumps(header).encode() + b"\n" + body
    with open(path, "wb") as f:
        f.write(gzip.compress(raw))


def synthetic(w=36, h=18):
    """10° cells. Landmass A: rows 6–8 (5–25°N), columns 34, 35, 0, 1
    (across the date line), Af. Landmass B: rows 11–13 (25–45°S), columns
    10–14 (80–30°W), Cfb, with a 2,000 m range (row 12, columns 11–12, H)
    and a lake (row 12, column 13)."""
    n = w * h
    v = {name: [0.0] * n for name, _, _ in LAYERS}
    v["koppen"] = [255] * n
    v["elevation"] = [-3000] * n
    for k in range(n):
        v["wind_u"][k] = 0.5
        v["wind_v"][k] = 0.5
        for m in MONTHS:
            v[f"temp_{m.lower()}"][k] = 15.0
            v[f"rain_{m.lower()}"][k] = 80.0
    for j in (6, 7, 8):
        for i in (34, 35, 0, 1):
            k = j * w + i
            v["category"][k], v["koppen"][k], v["elevation"][k] = 1, CODES.index("Af"), 100
            for m in MONTHS:
                v[f"temp_{m.lower()}"][k] = 26.0
                v[f"rain_{m.lower()}"][k] = 250.0
    for j in (11, 12, 13):
        for i in range(10, 15):
            k = j * w + i
            v["category"][k], v["koppen"][k], v["elevation"][k] = 1, CODES.index("Cfb"), 300
            for m in MONTHS:
                v[f"temp_{m.lower()}"][k] = 12.0
                v[f"rain_{m.lower()}"][k] = 60.0
    for i in (11, 12):
        k = 12 * w + i
        v["koppen"][k], v["elevation"][k] = CODES.index("H"), 2000
    k = 12 * w + 13
    v["category"][k], v["koppen"][k], v["elevation"][k] = 2, 255, 290
    return v


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.path = os.path.join(cls.tmp, "map.bin.gz")
        write_map(cls.path, 36, 18, synthetic())
        cls.d = mapquery.MapData.load(cls.path)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)


class Point(Base):
    def test_land_cell(self):
        p = mapquery.point(self.d, 15, 170)
        self.assertEqual((p["cell"]["i"], p["cell"]["j"]), (35, 7))
        self.assertEqual((p["category"], p["is_land"], p["elevation_m"]), ("Land", True, 100))
        self.assertEqual(p["koppen"], {"code": "Af", "name": "tropical rainforest"})
        self.assertEqual(p["temperature_c"]["warmest"], 26.0)
        self.assertEqual(p["precipitation_mm"]["annual"], 3000)
        self.assertEqual((p["wind"]["from_compass"], p["wind"]["from_deg"]), ("SW", 225))

    def test_ocean_cell(self):
        p = mapquery.point(self.d, 0, 0)
        self.assertEqual((p["category"], p["is_land"], p["koppen"]), ("Ocean", False, None))

    def test_lake_is_not_land(self):
        p = mapquery.point(self.d, -35, -45)
        self.assertEqual((p["category"], p["is_land"]), ("Lake", False))

    def test_longitude_wraps(self):
        self.assertEqual(mapquery.point(self.d, 15, 190)["cell"]["i"], 1)
        self.assertEqual(mapquery.point(self.d, 15, -170)["cell"]["i"], 1)

    def test_outside_latitude(self):
        with self.assertRaises(ValueError):
            mapquery.point(self.d, 95, 0)

    def test_non_wrapping_map(self):
        path = os.path.join(self.tmp, "half.bin.gz")
        write_map(path, 36, 18, synthetic(), lon_west=-90, lon_span=180, wraps=False)
        d = mapquery.MapData.load(path)
        with self.assertRaises(ValueError):
            mapquery.point(d, 0, 100)
        self.assertEqual(mapquery.point(d, 0, 89)["cell"]["i"], 35)


class Region(Base):
    def test_box_across_the_date_line(self):
        r = mapquery.region(self.d, 0, 30, 160, -160)
        self.assertEqual((r["cells"], r["land_share_percent"]), (12, 100.0))
        self.assertEqual([(k["code"], k["percent_of_land"]) for k in r["main_koppen"]], [("Af", 100.0)])
        self.assertEqual(r["land_mean_annual_rain_mm"], 3000)

    def test_land_share_is_area_weighted(self):
        r = mapquery.region(self.d, 0, 30, 150, -150)  # adds one ocean column each side
        self.assertEqual((r["cells"], r["land_share_percent"]), (18, 66.7))

    def test_mixed_climates_and_elevation(self):
        r = mapquery.region(self.d, -50, -20, -80, -30)
        self.assertEqual(r["land_elevation_m"], {"min": 300, "max": 2000})
        codes = {k["code"]: k["percent_of_land"] for k in r["main_koppen"]}
        self.assertEqual(set(codes), {"Cfb", "H"})
        self.assertGreater(codes["Cfb"], codes["H"])
        self.assertLess(r["land_share_percent"], 100)  # the lake is water

    def test_bad_box(self):
        with self.assertRaises(ValueError):
            mapquery.region(self.d, 10, 0, 0, 10)


class Overview(Base):
    def test_landmasses_and_ranges(self):
        o = mapquery.overview(self.d)
        self.assertEqual(o["landmass_count"], 2)
        a, b = o["landmasses"]
        by_name = {round(x["extent"]["north"]): x for x in (a, b)}
        north, south = by_name[30], by_name[-20]
        self.assertEqual(north["extent"], {"south": 0.0, "north": 30.0, "west": 160.0, "east": -160.0})
        self.assertEqual(north["main_koppen"][0]["code"], "Af")
        self.assertEqual(south["extent"], {"south": -50.0, "north": -20.0, "west": -80.0, "east": -30.0})
        self.assertEqual(len(o["mountain_ranges"]), 1)
        m = o["mountain_ranges"][0]
        self.assertEqual(m["peak"]["elevation_m"], 2000)
        self.assertEqual(m["extent"], {"south": -40.0, "north": -30.0, "west": -70.0, "east": -50.0})
        # largest first, by spherical area
        self.assertGreaterEqual(a["area_km2"], b["area_km2"])


class Server(Base):
    def rpc(self, messages, log=None):
        out = io.StringIO()
        mapquery.serve(self.d, log, stdin=io.StringIO("\n".join(json.dumps(m) for m in messages) + "\n"), stdout=out)
        return [json.loads(line) for line in out.getvalue().splitlines()]

    def test_handshake_list_and_call(self):
        log = os.path.join(self.tmp, "calls.jsonl")
        replies = self.rpc([
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "point", "arguments": {"lat": 15, "lon": 170}}},
            {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "point", "arguments": {"lat": 99, "lon": 0}}},
            {"jsonrpc": "2.0", "id": 5, "method": "nope"},
        ], log)
        self.assertEqual([r["id"] for r in replies], [1, 2, 3, 4, 5])  # no reply to the notification
        self.assertEqual(replies[0]["result"]["protocolVersion"], "2025-06-18")
        self.assertEqual([t["name"] for t in replies[1]["result"]["tools"]], ["point", "region", "overview"])
        self.assertEqual(json.loads(replies[2]["result"]["content"][0]["text"])["koppen"]["code"], "Af")
        self.assertTrue(replies[3]["result"]["isError"])
        self.assertEqual(replies[4]["error"]["code"], -32601)
        with open(log, encoding="utf-8") as f:
            calls = [json.loads(line) for line in f]
        self.assertEqual([(c["tool"], c["ok"]) for c in calls], [("point", True), ("point", False)])

    def test_real_stdio_process(self):
        msgs = [{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
                {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "overview", "arguments": {}}}]
        proc = subprocess.run([sys.executable, "-B", str(HERE / "mapquery.py"), "serve", self.path],
                              input="\n".join(json.dumps(m) for m in msgs) + "\n", capture_output=True, text=True,
                              encoding="utf-8", timeout=60)
        replies = [json.loads(line) for line in proc.stdout.splitlines()]
        self.assertEqual(len(replies), 2)
        self.assertEqual(json.loads(replies[1]["result"]["content"][0]["text"])["landmass_count"], 2)


class Cli(Base):
    def test_point_command(self):
        proc = subprocess.run([sys.executable, "-B", str(HERE / "mapquery.py"), "point", self.path, "15", "170"],
                              capture_output=True, text=True, encoding="utf-8", timeout=60)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(json.loads(proc.stdout)["koppen"]["code"], "Af")

    def test_not_a_map_file(self):
        path = os.path.join(self.tmp, "x.bin")
        with open(path, "wb") as f:
            f.write(b"hello\nworld\n")
        proc = subprocess.run([sys.executable, "-B", str(HERE / "mapquery.py"), "overview", path],
                              capture_output=True, text=True, encoding="utf-8", timeout=60)
        self.assertEqual(proc.returncode, 2)


@unittest.skipUnless(shutil.which("node"), "node not installed")
class NodeWrittenFile(unittest.TestCase):
    def test_reads_what_the_app_encoder_writes(self):
        tmp = tempfile.mkdtemp()
        try:
            out = pathlib.Path(tmp, "node.bin")
            module = (ROOT / "src" / "io" / "mapdata.js").as_uri()
            script = (
                f"import {{ encodeMapData, MAP_DATA_LAYERS }} from '{module}';"
                "import { writeFileSync } from 'node:fs';"
                "const W = 3, H = 2, v = {};"
                "for (const l of MAP_DATA_LAYERS) v[l.name] = new Float32Array(W * H).map((_, k) => k);"
                "v.elevation[5] = -4321; v.temp_jul[4] = -12.34; v.wind_v[1] = -0.5;"
                "writeFileSync(process.argv[1], encodeMapData({ width: W, height: H, lat_top: 90, lat_bottom: -90,"
                " lon_west: -180, lon_span: 360, wraps: true, radius_km: 6371, categories: ['Ocean','Land'],"
                " koppen_codes: ['Af'], months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] }, v));"
            )
            subprocess.run(["node", "--input-type=module", "-e", script, str(out)], check=True, timeout=60)
            d = mapquery.MapData.load(str(out))
            self.assertEqual(d.value("elevation", 5), -4321)
            self.assertAlmostEqual(d.value("temp_jul", 4), -12.3)
            self.assertAlmostEqual(d.value("wind_v", 1), -0.5)
            self.assertAlmostEqual(d.value("rain_dec", 3), 3.0)
        finally:
            shutil.rmtree(tmp)


if __name__ == "__main__":
    unittest.main()
