from __future__ import annotations
import math
import numpy as np
from .common import EPS, smoothstep


def direction(item: dict):
    angle=math.radians(float(item.get('directionDegrees',0.0)))
    return math.sin(angle),-math.cos(angle)


def build_inflows(width: int, height: int, currents: list[dict], ocean: np.ndarray):
    weight=np.zeros((height,width),np.float32); tu=np.zeros_like(weight); tv=np.zeros_like(weight); tracer=np.zeros_like(weight)
    yy,xx=np.mgrid[0:height,0:width].astype(np.float32); xn=(xx+.5)/width; yn=(yy+.5)/height
    for item in currents:
        entry=item.get('entry');
        if not isinstance(entry,dict): raise ValueError(f'Current {item.get("name","<unnamed>")} requires entry')
        edge=str(entry.get('edge','')).lower()
        if edge not in {'north','south','east','west'}: raise ValueError(f'Invalid edge: {edge}')
        pos=float(entry.get('position',.5)); span=max(float(entry.get('width',.2)),EPS)
        depth=max(float(entry.get('depth',6)),1.0); feather=max(float(entry.get('feather',.25)),EPS)
        along=xn if edge in {'north','south'} else yn
        if edge=='north': dist=yy+.5
        elif edge=='south': dist=height-yy-.5
        elif edge=='west': dist=xx+.5
        else: dist=width-xx-.5
        profile=np.exp(-.5*((along-pos)/max(span*.5,EPS))**2)
        strip=1-smoothstep(max(0,depth*(1-feather)),depth,dist)
        mask=(profile*strip*ocean).astype(np.float32)
        dx,dy=direction(item); strength=float(item.get('strength',1.0))
        weight += mask; tu += mask*dx*strength; tv += mask*dy*strength
        tracer=np.maximum(tracer,np.clip(mask*float(item.get('spawnWeight',1.0)),0,1))
    safe=np.maximum(weight,EPS)
    return np.clip(weight,0,1)*ocean, np.where(weight>EPS,tu/safe,0), np.where(weight>EPS,tv/safe,0), tracer


def impose_inflow(u,v,mask,tu,tv,relax):
    b=np.clip(mask*relax,0,1)
    return u*(1-b)+tu*b, v*(1-b)+tv*b


def open_boundaries(u,v,eta,tracer,inflow):
    eta[:,0]=eta[:,1]; eta[:,-1]=eta[:,-2]; eta[0]=eta[1]; eta[-1]=eta[-2]
    west=inflow[:,0]<=EPS; east=inflow[:,-1]<=EPS; north=inflow[0]<=EPS; south=inflow[-1]<=EPS
    for f in (u,v,tracer):
        f[west,0]=f[west,1]; f[east,-1]=f[east,-2]
        f[0,north]=f[1,north]; f[-1,south]=f[-2,south]
    return u,v,eta,tracer
