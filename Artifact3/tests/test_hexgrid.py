import itertools
import math
import unittest

from bridge import constants as C
from bridge import hexgrid as H

POINTY = H.Grid("pointy", 2.0, 2.0)
FLAT = H.Grid("flat", 2.0, 2.0)
OFFSET_GRIDS = (H.Grid("pointy", 2.0, 2.0, 1.5, -3.25),
                H.Grid("flat", 1.0, 1.0, -7.0, 2.0),
                H.Grid("pointy", 2.0, 3.0, 0.0, 0.0),   # non-uniform size
                H.Grid("flat", 3.0, 2.0, 0.5, 0.5))
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
        grid = H.Grid("pointy", 2.0, 2.0, 10.0, -4.0)
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


class RotationTests(unittest.TestCase):
    def test_six_steps_is_identity(self):
        for h in HEXES:
            self.assertEqual(H.rotate(h, 6), h)
            self.assertEqual(H.distance((0, 0), H.rotate(h, 1)), H.distance((0, 0), h))

    def test_rotation_steps_snap_and_wrap(self):
        args = (60.0, 0.0, 1)
        self.assertEqual(H.rotation_steps(0.0, *args)[0], 0)
        self.assertEqual(H.rotation_steps(59.0, *args)[0], 1)
        self.assertEqual(H.rotation_steps(359.0, *args)[0], 0)
        self.assertEqual(H.rotation_steps(-61.0, *args)[0], 5)
        self.assertEqual(H.rotation_steps(300.0, *args)[0], 5)
        self.assertAlmostEqual(H.rotation_steps(359.0, *args)[1], -1.0)
        self.assertEqual(H.rotation_steps(60.0, 60.0, 0.0, -1)[0], 5)
        self.assertEqual(H.rotation_steps(90.0, 60.0, 30.0, 1)[0], 1)

    def test_symmetry(self):
        self.assertTrue(H.is_rotation_symmetric(C.FOOTPRINTS[1]))
        self.assertTrue(H.is_rotation_symmetric(C.FOOTPRINTS[3]))
        self.assertFalse(H.is_rotation_symmetric(C.FOOTPRINTS[2]))
        self.assertFalse(H.is_rotation_symmetric(C.FOOTPRINTS[4]))


class FootprintTests(unittest.TestCase):
    def place(self, grid, size, hexes_at_rest, steps=0):
        """Put a mini exactly on the centroid of `hexes_at_rest` and place it."""
        pts = [H.axial_to_world(grid, h) for h in hexes_at_rest]
        x = sum(p[0] for p in pts) / len(pts)
        z = sum(p[1] for p in pts) / len(pts)
        return H.place_footprint(grid, x, z, C.FOOTPRINTS[size], steps)

    def test_shape_sizes(self):
        self.assertEqual({k: len(v) for k, v in C.FOOTPRINTS.items()},
                         {0.5: 1, 1: 1, 2: 3, 3: 7, 4: 12})

    def test_size_1_and_half(self):
        for size in (0.5, 1):
            p = H.place_footprint(POINTY, 7.12, -5.15, C.FOOTPRINTS[size], 0)
            self.assertEqual(p.hexes, ((5, -3),))
            self.assertLess(p.offset_error, C.PLACEMENT_TOLERANCE_HEX)

    def test_size_2_triangle_both_orientations(self):
        up = [(2, 0), (3, 0), (2, 1)]
        p = self.place(POINTY, 2, up)
        self.assertEqual(set(p.hexes), set(up))
        self.assertAlmostEqual(p.offset_error, 0.0)
        down = [(-3, -1), (-3, 0), (-4, 0)]   # one step: (0,0),(0,1),(-1,1)
        p = self.place(POINTY, 2, down, steps=1)
        self.assertEqual(set(p.hexes), set(down))

    def test_size_2_every_rotation_is_a_triangle(self):
        for grid in (POINTY, FLAT):
            for steps in range(6):
                p = H.place_footprint(grid, -3.3, 4.1, C.FOOTPRINTS[2], steps)
                with self.subTest(grid=grid.orientation, steps=steps):
                    self.assertEqual(len(set(p.hexes)), 3)
                    for a, b in itertools.combinations(p.hexes, 2):
                        self.assertEqual(H.distance(a, b), 1)

    def test_size_3_flower(self):
        center = (6, 2)
        expected = {center, *H.neighbors(center)}
        for steps in range(6):
            p = self.place(POINTY, 3, [center], steps)
            self.assertEqual(set(p.hexes), expected)
        p = self.place(FLAT, 3, [(-4, -2)])
        self.assertEqual(set(p.hexes), {(-4, -2), *H.neighbors((-4, -2))})

    def test_size_4_rows_3_4_3_2(self):
        shape = C.FOOTPRINTS[4]
        rows = {}
        for q, r in shape:
            rows.setdefault(r, []).append(q)
        self.assertEqual([len(rows[r]) for r in sorted(rows)], [3, 4, 3, 2])
        # Each row is a contiguous run.
        for qs in rows.values():
            self.assertEqual(sorted(qs), list(range(min(qs), max(qs) + 1)))
        self.assertTrue(connected(shape))

    def test_size_4_every_rotation(self):
        for grid in (POINTY, FLAT):
            for steps in range(6):
                p = H.place_footprint(grid, 2.2, -6.7, C.FOOTPRINTS[4], steps)
                with self.subTest(grid=grid.orientation, steps=steps):
                    self.assertEqual(len(set(p.hexes)), 12)
                    self.assertTrue(connected(p.hexes))
        # A Size 4 placed on its own centroid reproduces itself, at negatives.
        shape = [(q - 4, r - 3) for q, r in C.FOOTPRINTS[4]]
        self.assertEqual(set(self.place(POINTY, 4, shape).hexes), set(shape))

    def test_rotated_size_4_matches_rotated_shape(self):
        for steps in range(6):
            rotated = [H.rotate(h, steps) for h in C.FOOTPRINTS[4]]
            shifted = [(q + 3, r - 5) for q, r in rotated]
            p = self.place(FLAT, 4, shifted, steps)
            self.assertEqual(set(p.hexes), set(shifted))

    def test_off_center_mini_reports_error(self):
        # A Size 2 mini sitting on a hex center is halfway between placements.
        p = H.place_footprint(POINTY, 0.0, 0.0, C.FOOTPRINTS[2], 0)
        self.assertGreater(p.offset_error, C.PLACEMENT_TOLERANCE_HEX)


class AreaAndLabelTests(unittest.TestCase):
    def test_hexes_in_rect_row(self):
        s = math.sqrt(3)
        self.assertEqual(H.hexes_in_rect(POINTY, 2.0, -2 * s, 5.0, 1.0),
                         ((1, -2), (2, -2), (3, -2)))

    def test_hexes_in_rect_zone(self):
        got = set(H.hexes_in_rect(POINTY, 8.0, 0.0, 5.0, 4.4))
        self.assertEqual(got, {(4, 0), *H.neighbors((4, 0))})

    def test_small_rect_falls_back_to_center_hex(self):
        self.assertEqual(H.hexes_in_rect(POINTY, 7.3, -5.0, 0.1, 0.1), ((5, -3),))

    def test_labels(self):
        self.assertEqual(H.label(POINTY, (0, 0)), "c0r0")
        self.assertEqual(H.label(POINTY, (5, -3)), "c3r-3")
        self.assertEqual(H.label(POINTY, (6, 2)), "c7r2")
        self.assertEqual(H.label(POINTY, (-1, 1)), "c-1r1")
        self.assertEqual(H.label(FLAT, (-2, 1)), "c-2r0")
        self.assertEqual(H.label(FLAT, (3, -1)), "c3r0")

    def test_labels_are_unique(self):
        for grid in (POINTY, FLAT):
            labels = [H.label(grid, h) for h in HEXES]
            self.assertEqual(len(set(labels)), len(labels))


if __name__ == "__main__":
    unittest.main()
