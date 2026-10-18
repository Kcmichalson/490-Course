// Tunable simulation constants. Every "start" value from SPEC.md lives here,
// so calibration happens in one place. Each constant names the real-world
// effect it approximates.
//
// M1 has no simulation yet; constants arrive with their milestones.

// Planet radius in km (Earth). Converts grid cells to km; east-west cell
// width shrinks with cos(latitude). Becomes a planet slider in M3.
export const PLANET_RADIUS_KM = 6371;
