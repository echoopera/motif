// Kaleido Wall: mirror-fold kaleidoscope. Rotation and drift use whole cycles per loop (drift travels one full
// mirror period per cycle). Bass-style zoom comes from the kick envelope.
vec2 W_mir(vec2 x){return 1.0-abs(1.0-mod(x,2.0));}
vec4 motif(vec2 uv,vec2 fc){
  vec2 A=M_asp();
  float k=min(W_drive(),1.2);
  float spin=sign(float(p_spin))*safeCycles(abs(float(p_spin)));
  vec2 p=rot(TAU*spin*u_p)*(uv-v_center());
  float r=length(p),a=atan(p.y,p.x);
  float sa=TAU/float(p_segments);
  a=abs(mod(a,sa)-sa*0.5);
  vec2 dir=vec2(cos(a),sin(a));
  float sc=p_scale*(1.0+p_breathe*lsin(1.0,0.0))*(1.0-0.1*k);
  vec2 s=r*dir*sc/A+0.5+vec2(2.0*safeCycles(float(p_drift))*u_p,0.0);
  float ca=(0.004+0.02*k)*p_chroma;
  vec3 col=vec3(W_src(W_mir(s+dir*ca/A)).r,W_src(W_mir(s)).g,W_src(W_mir(s-dir*ca/A)).b);
  col*=0.85+0.4*k;
  col+=exp(-r*3.0)*0.14*u_a0;
  col+=u_a0*smoothstep(0.012,0.0,a)*0.4*p_seams*r;
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
