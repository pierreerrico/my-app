#!/usr/bin/env python3
"""Generate a regional hybrid physical/procedural ocean-current map."""
from __future__ import annotations
import argparse,json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from currents.bathymetry import load as load_bathymetry
from currents.model import HybridOceanModel
from currents.diagnostics import save as save_outputs
from currents.atmosphere import latitude_bounds


def resolve(path:str)->Path:
    p=Path(path); return p if p.is_absolute() else ROOT/p


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('nation'); ap.add_argument('--iterations',type=int); ap.add_argument('--width',type=int); ap.add_argument('--solver-config',type=Path,default=ROOT/'scripts'/'currents'/'ocean-solver.json'); args=ap.parse_args()
    source_path=ROOT/'app'/'data'/'maps'/args.nation/f'{args.nation}-source.json'
    source=json.loads(source_path.read_text(encoding='utf-8')); ocean_cfg=source['ocean']; grid=ocean_cfg.get('grid',{})
    width=args.width or int(grid.get('width',512)); proportional=max(32,round(width*float(source['mapHeightKm'])/float(source['mapWidthKm']))); height=proportional if args.width else int(grid.get('height',proportional))
    solver_path=args.solver_config if args.solver_config.is_absolute() else ROOT/args.solver_config
    cfg=json.loads(solver_path.read_text(encoding='utf-8'))
    bathy_cfg=source['bathymetry']; bathy=load_bathymetry(resolve(bathy_cfg['file']),width,height,bathy_cfg,int(cfg.get('coastInfluenceCells',5)))
    result=HybridOceanModel(source,cfg,bathy,width,height).run(args.iterations)
    out=ocean_cfg['output']; outfile=resolve(out['file']); diag=resolve(out.get('diagnosticsDirectory','scripts/currents/generated-currents')); prefix=out.get('prefix',f'{args.nation}-current')
    save_outputs(result,bathy,outfile,diag,prefix,cfg.get('export',{}))
    north,south=latitude_bounds(source)
    print(f'Latitude: {south:.3f}° to {north:.3f}°'); print(f'Bathymetry: {resolve(bathy_cfg["file"])}'); print(f'Current map: {outfile}'); print(f'Particle preview: {diag/f"{prefix}-particles.png"}')

if __name__=='__main__': main()
