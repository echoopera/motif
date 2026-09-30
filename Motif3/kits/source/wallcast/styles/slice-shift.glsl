// Slice Shift: row and column-block displacement with an RGB tear and scanline bed. Slots change through
// tslot(), so the limiter caps tears at 3 changes per second. The kick raises tear odds and reach.
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res;
  float k=min(W_drive(),1.2);
  float slot=tslot(float(p_rate));
  float rows=float(p_bands),b=floor(q.y*rows);
  float h=h21(vec2(b,slot));
  float on=step(1.0-(0.10+0.45*p_tear)*(0.35+0.65*min(k,1.0)),h);
  float sh=(h21(vec2(b,slot+7.0))-0.5)*0.32*p_tear*on*(0.3+k);
  float cb=floor(q.x*8.0);
  float hv=h21(vec2(cb+31.0,slot));
  float ov=step(0.94-0.12*min(k,1.0),hv)*p_blocks;
  vec2 u2=q+vec2(sh,0.0)+vec2(0.0,ov*(h21(vec2(cb,slot+3.0))-0.5)*0.2);
  float ca=(0.004+0.05*abs(sh))*p_rgb;
  vec3 col=vec3(W_src(u2+vec2(ca,0.0)).r,W_src(u2).g,W_src(u2-vec2(ca,0.0)).b);
  col*=1.0-p_scan*0.12*(0.5+0.5*sin(fc.y*PI));
  float e=smoothstep(0.06,0.0,fract(q.y*rows));
  col+=on*e*u_a0*0.5*min(k,1.0);
  col+=on*0.03*u_a1*step(0.5,fract(b*0.5));
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
