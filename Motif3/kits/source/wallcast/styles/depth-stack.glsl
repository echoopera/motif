// Depth Stack: background, a self-derived mid layer and a foreground input, each at its own parallax depth.
// The camera is an XY pad plus a looping orbit. The foreground keeps its own alpha; an opaque foreground can
// be keyed by luminance. With no foreground attached, a procedural hardware slab plays.
vec4 W_slab(vec2 qq){
  vec2 A=M_asp();
  vec2 p=rot(-0.28)*((qq-0.5)*A-vec2(0.16,-0.05));
  float d=sdBox(p,vec2(0.30,0.16))-0.02;
  float a=1.0-smoothstep(0.0,aa()*1.2,d);
  if(a<=0.0) return vec4(0.0);
  vec3 c=u_bg*2.0+u_ink*0.05*(0.5+0.5*(p.y/0.18));
  float sc=1.0-smoothstep(0.0,aa(),sdBox(p-vec2(-0.06,0.07),vec2(0.13,0.05)));
  c=mix(c,u_a1*0.5,sc);
  vec2 pg=(p-vec2(-0.2,-0.08))/0.045,pid=floor(pg),pf=fract(pg)-0.5;
  float pad=step(0.0,pid.x)*step(pid.x,7.0)*step(0.0,pid.y)*step(pid.y,1.0)*(1.0-smoothstep(0.36,0.42,max(abs(pf.x),abs(pf.y))));
  float lit=step(0.55,h21(pid+vec2(3.0,9.0)));
  c=mix(c,mix(u_bg*3.0,u_a0*1.6,lit),pad);
  return vec4(c*a,a);
}
vec4 W_fore(vec2 qq){
  if(u_foreOn>0.5){
    vec4 f=m_fore(clamp(qq,vec2(0.0),vec2(1.0)));
    if(p_lumaKey&&f.a>0.999){
      float a=smoothstep(p_keyLevel,p_keyLevel*3.0+0.001,luma(f.rgb));
      f=vec4(f.rgb*a,a);
    }
    return f;
  }
  return W_slab(qq);
}
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res,A=M_asp();
  float k=W_drive();
  vec2 cq=(v_camera()+p_orbit*0.2*lc(1.0,0.0))/A;
  vec2 sb=cq*(0.06*p_depthBg),sm=cq*(0.14*p_depthMid),sf=cq*(0.26*p_depthFore);
  float l0=luma(W_src(q-sb));
  vec3 col=W_src(q-sb*(0.6+min(l0,1.0)*1.2))*0.92;
  vec3 mid=min(W_src((q-0.5)/1.07+0.5-sm),vec3(1.0));
  col=1.0-(1.0-col)*(1.0-mid*p_midBlend*smoothstep(0.02,0.4,luma(mid)));
  float z=1.0+0.10*p_depthFore+0.03*k;
  vec2 qf=(q-0.5)/z+0.5-sf;
  vec4 f=W_fore(qf);
  float sa=W_fore(qf+vec2(0.012,-0.02)).a;
  col*=1.0-p_shadow*0.55*sa*(1.0-f.a);
  col=f.rgb+col*(1.0-f.a);
  if(safeCycles(float(p_sweeps))>=1.0){
    float t=lsaw(safeCycles(float(p_sweeps)),0.0);
    col+=u_a0*0.16*smoothstep(0.0,0.15,0.15-abs(q.x*0.6+q.y*0.4-t*1.6+0.3));
  }
  col+=u_a0*0.04*(1.0-q.y);
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
