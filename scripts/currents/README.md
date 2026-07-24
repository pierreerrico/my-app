# Ocean Current Engine v4

The generator uses a scale-separated hybrid pipeline:

1. **Large-scale transport** — shallow-water-inspired free surface, wind,
   Coriolis, inflow boundaries and bottom drag.
2. **Bathymetric steering** — depth-integrated transport follows significant
   isobath slopes.
3. **Obstacle analysis** — connected land components are identified as
   islands, coastal masses or small obstacles.
4. **Wake vorticity** — each obstacle creates a flow-dependent downstream wake
   in vorticity space, including restrained counter-rotating lobes.
5. **Vorticity memory** — wake and separation vorticity are advected and decay
   slowly.
6. **Velocity reconstruction** — a streamfunction Poisson solve converts the
   remembered vorticity into a divergence-free rotational velocity.
7. **Final field** — base and rotational velocities are combined for export,
   tracer transport and particle integration.

The wake and eddy stages never add arbitrary X/Y velocity impulses directly.
They operate in signed vorticity and are reconstructed into velocity only at
one dedicated pipeline stage.

Run:

```bash
python scripts/generate-ocean-currents.py selodia
```

Important diagnostics include `base-speed`, `rotational-speed`, `wake`,
`eddy-memory`, `streamfunction`, `particles`, and the final `preview`.
