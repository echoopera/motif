// Shockwave: every kick launches a refractive ring; earlier rings trail behind. Ring age is fract(u_p*r) plus the
// ring index, so at each beat boundary ring i takes over from ring i-1 with no jump. r passes the limiter.
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res,A=M_asp();
  float r=safeCycles(float(p_beats));
  vec2 c=uv-v_origin();
  float d=length(c);
  vec2 dn=normalize(c+vec2(1e-5));
  vec2 disp=vec2(0.0);
  float glow=0.0;
  if(r>=1.0){
    for(int i=0;i<3;i++){
      if(i>=p_rings) break;
      float age=fract(u_p*r)+float(i);
      float R=age*p_speed;
      float amp=exp(-age*1.1)*(i==0?1.0:0.75)*(p_hitAmt+p_hit*1.5);
      float ring=exp(-pow((d-R)*p_sharp,2.0));
      disp+=dn*ring*amp*-0.055*p_refract;
      glow+=ring*amp;
    }
  }
  vec2 dq=disp/A,ca=dn/A*glow*0.012*p_chroma;
  vec3 col=vec3(W_src(q+dq+ca).r,W_src(q+dq).g,W_src(q+dq-ca).b);
  col+=glow*u_a0*p_glow;
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
