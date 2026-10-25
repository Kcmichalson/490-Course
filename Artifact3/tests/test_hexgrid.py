import itertools
import math
import unittest

from bridge import constants as C
from bridge import hexgrid as H

POINTY = H.tts_lattice("pointy", 2.0, 2.0)
FLAT = H.tts_lattice("flat", 2.0, 2.0)
OFFSET_GRIDS = (H.tts_lattice("pointy", 2.0, 2.0, 1.5, -3.25),
                H.tts_lattice("flat", 1.0, 1.0, -7.0, 2.0),
                H.tts_lattice("pointy", 2.0, 3.0, 0.0, 0.0),   # non-uniform size
                H.tts_lattice("flat", 3.0, 2.0, 0.5, 0.5))
HEXES = list(itertools.product(range(-5, 6), repeat=2))


def connected(hexes):
    hexes = set(hexes)
    start = next(iter(hexes))
    seen, todo = {start}, [start]
    while todo:
        for n in H.neighbors(todo.pop()):
            if n in hexes and n not in seen:
                seen.add(n)
                todo.append(n)
    return seen == hexes


class ConversionTests(unittest.TestCase):
    def test_round_trip_both_orientations_with_negatives(self):
        for grid in (POINTY, FLAT) + OFFSET_GRIDS:
            for h in HEXES:
                with self.subTest(grid=grid, hex=h):
                    self.assertEqual(H.world_to_axial(grid, *H.axial_to_world(grid, h)), h)

    def test_hand_checked_world_positions(self):
        s = math.sqrt(3)
        # pointy, size 2: x = 2(q + r/2), z = sqrt(3) r
        self.assertEqual(H.world_to_axial(POINTY, 7.0, -3 * s), (5, -3))
        self.assertEqual(H.world_to_axial(POINTY, 14.0, 2 * s), (6, 2))
        self.assertEqual(H.world_to_axial(POINTY, -1.0, s), (-1, 1))
        # flat, size 2: x = sqrt(3) q, z = 2(r + q/2)
        self.assertEqual(H.world_to_axial(FLAT, -2 * s, 0.0), (-2, 1))
        self.assertEqual(H.world_to_axial(FLAT, 3 * s, 1.0), (3, -1))

    def test_offset_moves_the_origin(self):
        grid = H.tts_lattice("pointy", 2.0, 2.0, 10.0, -4.0)
        self.assertEqual(H.world_to_axial(grid, 10.0, -4.0), (0, 0))
        self.assertEqual(H.axial_to_world(grid, (1, 0)), (12.0, -4.0))

    def test_rounding_near_edges(self):
        # Pointy size 2: the edge between (0,0) and (1,0) is at x = 1.
        self.assertEqual(H.world_to_axial(POINTY, 0.99, 0.0), (0, 0))
        self.assertEqual(H.world_to_axial(POINTY, 1.01, 0.0), (1, 0))
        self.assertEqual(H.world_to_axial(POINTY, -0.99, 0.0), (0, 0))
        self.assertEqual(H.world_to_axial(POINTY, -1.01, 0.0), (-1, 0))
        # Flat size 2: the edge between (0,0) and (0,1) is at z = 1.
        self.assertEqual(H.world_to_axial(FLAT, 0.0, 0.99), (0, 0))
        self.assertEqual(H.world_to_axial(FLAT, 0.0, 1.01), (0, 1))


class DistanceTests(unittest.TestCase):
    def test_hand_checked_distances(self):
        cases = [((0, 0), (0, 0), 0), ((0, 0), (1, 0), 1), ((0, 0), (0, -1), 1),
                 ((0, 0), (2, -1), 2), ((0, 0), (5, -3), 5), ((-2, 1), (2, 0), 4),
                 ((-3, -3), (3, 3), 12), ((1, -4), (-2, 2), 6), ((3, 0), (5, -3), 3)]
        for a, b, d in cases:
            with self.subTest(a=a, b=b):
                self.assertEqual(H.distance(a, b), d)
                self.assertEqual(H.distance(b, a), d)

    def test_neighbors_are_six_distinct_at_distance_one(self):
        ns = H.neighbors((-2, 3))
        self.assertEqual(len(set(ns)), 6)
        self.assertTrue(all(H.distance((-2, 3), n) == 1 for n in ns))

    def test_footprint_distance_is_nearest_pair(self):
        ironclad = [(2, 0), (3, 0), (2, 1)]
        demolisher = [(6, 2), (7, 2), (5, 2), (6, 3), (6, 1), (7, 1), (5, 3)]
        self.assertEqual(H.footprint_distance(ironclad, [(5, -3)]), 3)
        self.assertEqual(H.footprint_distance(ironclad, demolisher), 4)
        self.assertEqual(H.footprint_distance([(0, 0)], demolisher), 7)
        self.assertEqual(H.footprint_distance([(0, 0)], [(1, 0)]), 1)


def corner(grid, hexes):
    """World (x, z) of the corner shared by three mutually adjacent hexes."""
    pts = [H.axial_to_world(grid, h) for h in hexes]
    return (sum(p[0] for p in pts) / 3, sum(p[1] for p in pts) / 3)


def rows(hexes):
    by_r = {}
    for q, r in hexes:
        by_r.setdefault(r, []).append(q)
    return [len(by_r[r]) for r in sorted(by_r)]


# Two triangles from the user's drawing orientation (two hexes on the upper
# row, r smaller) and the opposite orientation (one hex on the upper row).
TWO_ON_TOP = [(2, 0), (3, 0), (2, 1)]
ONE_ON_TOP = [(3, 0), (2, 1), (3, 1)]   # shares the edge (3,0)-(2,1)
# The LOG.md drawing of Size 4: rows of 3, 4, 3, 2.
SIZE_4_DRAWING = {(-1, 0), (0, 0), (1, 0),
                  (-2, 1), (-1, 1), (0, 1), (1, 1),
                  (-2, 2), (-1, 2), (0, 2),
                  (-2, 3), (-1, 3)}


class FootprintTests(unittest.TestCase):
    def test_size_tables(self):
        self.assertEqual({k: len(v) for k, v in C.FOOTPRINTS.items()},
                         {0.5: 1, 1: 1, 3: 7})
        self.assertEqual(C.CORNER_RINGS, {2: 0, 4: 1})
        self.assertEqual(C.SIZES, (0.5, 1, 2, 3, 4))

    def test_size_1_and_half(self):
        for size in (0.5, 1):
            p = H.place_footprint(POINTY, 7.12, -5.15, C.FOOTPRINTS[size])
            self.assertEqual(p.hexes, ((5, -3),))
            self.assertLess(p.offset_error, C.PLACEMENT_TOLERANCE_HEX)

    def test_size_2_corner_footprint(self):
        for grid in (POINTY, FLAT):
            for tri in (TWO_ON_TOP, ONE_ON_TOP):
                p = H.corner_footprint(grid, *corner(grid, tri), 0)
                self.assertEqual(set(p.hexes), set(tri))
                self.assertAlmostEqual(p.offset_error, 0.0)

    def test_size_2_and_4_always_valid_across_positions(self):
        # Sweep positions across several hexes, including negatives.
        for grid in (POINTY, FLAT) + OFFSET_GRIDS:
            for i in range(-12, 13):
                for j in range(-12, 13):
                    x, z = i * 0.37 + 0.011, j * 0.41 - 0.007
                    tri = H.corner_footprint(grid, x, z, 0).hexes
                    big = H.corner_footprint(grid, x, z, 1).hexes
                    with self.subTest(grid=grid, x=x, z=z):
                        self.assertEqual(len(set(tri)), 3)
                        for a, b in itertools.combinations(tri, 2):
                            self.assertEqual(H.distance(a, b), 1)
                        self.assertEqual(len(set(big)), 12)
                        self.assertTrue(set(tri) <= set(big))
                        self.assertTrue(connected(big))

    def test_size_2_mini_slightly_off_its_corner_keeps_its_triangle(self):
        x, z = corner(POINTY, TWO_ON_TOP)
        for dx, dz in ((0.15, 0.0), (-0.1, 0.12), (0.0, -0.15)):
            p = H.corner_footprint(POINTY, x + dx, z + dz, 0)
            self.assertEqual(set(p.hexes), set(TWO_ON_TOP))

    def test_size_3_flower(self):
        for grid, center in ((POINTY, (6, 2)), (FLAT, (-4, -2))):
            p = H.place_footprint(grid, *H.axial_to_world(grid, center), C.FOOTPRINTS[3])
            self.assertEqual(set(p.hexes), {center, *H.neighbors(center)})
            self.assertAlmostEqual(p.offset_error, 0.0)

    def test_size_4_matches_the_drawing(self):
        # Size 4 = the Size 2 triangle plus every hex touching it (user,
        # Prompt 13; matches the rulebook figure and the LOG.md drawing).
        tri = [(0, 1), (-1, 1), (-1, 2)]   # two on top, like TWO_ON_TOP
        p = H.corner_footprint(POINTY, *corner(POINTY, tri), 1)
        self.assertEqual(set(p.hexes), SIZE_4_DRAWING)
        self.assertEqual(rows(p.hexes), [3, 4, 3, 2])
        self.assertAlmostEqual(p.offset_error, 0.0)

    def test_size_4_other_corner_is_rows_2_3_4_3(self):
        p = H.corner_footprint(POINTY, *corner(POINTY, ONE_ON_TOP), 1)
        self.assertEqual(rows(p.hexes), [2, 3, 4, 3])
        self.assertTrue(connected(p.hexes))

    def test_flip_is_a_move_to_the_neighboring_corner(self):
        # The two corners at the ends of the shared edge (3,0)-(2,1) are
        # one corner apart; moving the base between them flips the shape.
        for rings in (0, 1):
            a = H.corner_footprint(POINTY, *corner(POINTY, TWO_ON_TOP), rings).hexes
            b = H.corner_footprint(POINTY, *corner(POINTY, ONE_ON_TOP), rings).hexes
            self.assertNotEqual(set(a), set(b))
            self.assertEqual(len(a), len(b))

    def test_off_center_mini_reports_error(self):
        # A Size 2 or 4 mini sitting on a hex center isn't on any corner;
        # a Size 1 mini sitting on a corner isn't on any hex center.
        for rings in (0, 1):
            p = H.corner_footprint(POINTY, 0.0, 0.0, rings)
            self.assertGreater(p.offset_error, C.PLACEMENT_TOLERANCE_HEX)
        p = H.place_footprint(POINTY, *corner(POINTY, TWO_ON_TOP), C.FOOTPRINTS[1])
        self.assertGreater(p.offset_error, C.PLACEMENT_TOLERANCE_HEX)


class AreaTests(unittest.TestCase):
    def test_hexes_in_rect_row(self):
        s = math.sqrt(3)
        self.assertEqual(H.hexes_in_rect(POINTY, 2.0, -2 * s, 5.0, 1.0),
                         ((1, -2), (2, -2), (3, -2)))

    def test_hexes_in_rect_zone(self):
        got = set(H.hexes_in_rect(POINTY, 8.0, 0.0, 5.0, 4.4))
        self.assertEqual(got, {(4, 0), *H.neighbors((4, 0))})

    def test_small_rect_falls_back_to_center_hex(self):
        self.assertEqual(H.hexes_in_rect(POINTY, 7.3, -5.0, 0.1, 0.1), ((5, -3),))


if __name__ == "__main__":
    unittest.main()
