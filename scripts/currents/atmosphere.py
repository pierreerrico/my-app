from __future__ import annotations
import math
import numpy as np
from .common import smoothstep


def latitude_bounds(source: dict):
    north=float(source['topLeft']['latitude'])
    radius=float(source.get('planetRadiusKm',6371.0))
    span=math.degrees(float(source['mapHeightKm'])/radius)
    return north,north-span


def latitude_grid(source: dict, height: int, width: int):
    north,south=latitude_bounds(source)
    return np.repeat(np.linspace(north,south,height,dtype=np.float32)[:,None],width,axis=1)


def dominant_wind(source: dict, width: int, height: int, cfg: dict):
    lat=latitude_grid(source,height,width); a=np.abs(lat)
    t=float(cfg.get('transitionWidthDegrees',6.0))
    tropical=1-smoothstep(30-t,30+t,a)
    wester=smoothstep(30-t,30+t,a)*(1-smoothstep(60-t,60+t,a))
    polar=smoothstep(60-t,60+t,a)
    wx=(wester-tropical-polar).astype(np.float32)
    wy=(float(cfg.get('meridionalStrength',.14))*np.sign(lat)*(tropical-polar)).astype(np.float32)
    yy,xx=np.mgrid[0:height,0:width].astype(np.float32)
    xn=xx/max(width-1,1); yn=yy/max(height-1,1)
    amp=float(cfg.get('variationStrength',.12)); scale=float(cfg.get('variationScale',2.2))
    phase=2*np.pi*(scale*xn+.37*np.sin(2*np.pi*yn))
    wx += amp*np.cos(phase)*.22; wy += amp*np.sin(phase)*.35
    return wx,wy,lat
