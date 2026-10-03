// Glyph Mosaic: the image rebuilt from 5x5 bitmap marks chosen by brightness, with falling data trails and
// live-cell flicker. Rain runs at whole cycles per loop; flicker changes through tslot(), so the limiter applies.
// Data feed shifts the density: map a data channel to it and the mosaic fills or thins with the number.
const uint W_G[10]=uint[10](0u,4096u,131200u,4357252u,14815428u,2167071u,15255086u,11512810u,15252014u,33222335u);
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res,A=M_asp();
  float k=min(W_drive(),1.2);
  vec2 grid=vec2(float(p_cols),float(p_cols)/(1.7*A.x));
  vec2 p=q*grid,id=floor(p),f=fract(p);
  vec3 c=W_src((id+0.5)/grid);
  float lp=pow(luma(c),0.36);
  float sp=floor(min(float(p_rain)*(1.0+floor(h11(id.x+9.0)*3.0)),u_safe>0.5?3.0*u_L:1.0e4));
  float head=fract(h11(id.x)*7.0+sp*u_p);
  float rain=exp(-fract(head-(1.0-(id.y+0.5)/grid.y))*6.0)*(p_rain>0?1.0:0.0);
  float lev=clamp(lp*p_contrast+(p_feed-0.5)*0.5+rain*0.25*(0.6+k),0.0,0.999);
  int idx=int(lev*10.0);
  float hf=h21(id*1.7+vec2(tslot(3.0),0.0));
  float swap=step(1.0-p_flicker*0.12,hf)*step(0.2,lp);
  if(swap>0.5) idx=1+int(h21(id+vec2(tslot(10.0),4.0))*9.0);
  int gx=int(f.x*5.0),gy=int((1.0-f.y)*5.0);
  float bit=float((W_G[idx]>>uint(gy*5+gx))&1u);
  vec3 tint=p_tone==0?c*2.4:(p_tone==1?u_a0*(0.3+lp*1.5):u_ink*(0.3+lp*1.3));
  vec3 col=tint*bit*(1.0+0.6*k)+c*0.08+u_a0*rain*bit*0.7;
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
