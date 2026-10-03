// Halftone Pulse: one screen per colour channel at its own angle. Light mode adds RGB dots on the dark
// ground; Print mode subtracts CMY inks from a paper ground. Dot size breathes with the kick.
float W_dot(vec2 q,float ang,int ch,float cells,float gain,bool inv){
  vec2 A=M_asp();
  vec2 p=rot(ang)*(q*A)*cells;
  vec2 id=floor(p)+0.5,f=p-id;
  vec2 qq=(rot(-ang)*(id/cells))/A;
  vec3 s=W_src(qq);
  float v=ch==0?s.r:(ch==1?s.g:s.b);
  v=inv?1.0-clamp(pow(v,0.4545),0.0,1.0):pow(clamp(v,0.0,1.0),0.5);
  float r=(inv?sqrt(v):v)*gain;
  float l=length(f),aa2=fwidth(l)*0.75+1e-4;
  return smoothstep(r+aa2,r-aa2,l);
}
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res;
  float k=W_drive();
  float dr=p_drift*lsin(1.0,0.0);
  float cells=float(p_cells);
  float gain=p_gain*(1.0+0.28*min(k,1.2));
  float reg=p_registration*0.004;
  bool print=p_inkMode==1;
  vec3 cov=vec3(W_dot(q+vec2(reg,0.0),0.26+dr,0,cells,gain,print),
                W_dot(q,0.79-dr,1,cells,gain,print),
                W_dot(q-vec2(reg,0.0),1.31+dr*1.5,2,cells,gain,print));
  vec3 col;
  if(print){
    vec3 paper=u_ink*0.9;
    col=paper*mix(vec3(1.0),vec3(0.02,0.95,1.0),cov.r)*mix(vec3(1.0),vec3(1.0,0.03,0.9),cov.g)*mix(vec3(1.0),vec3(1.0,0.95,0.03),cov.b);
  }else{
    col=cov*0.95+W_src(q)*p_under+u_bg;
  }
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
