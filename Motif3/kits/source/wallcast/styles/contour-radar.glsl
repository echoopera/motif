// Contour Radar: iso-luminance contour lines, a radar sweep that lights them, range rings and an XY reticle
// that reads out the local level as digits. Contours drift by whole major intervals per loop, so the loop closes.
float W_lb(vec2 q){
  vec2 d=3.0/u_res;
  float s=0.0;
  for(int i=-1;i<=1;i++) for(int j=-1;j<=1;j++) s+=luma(W_src(q+vec2(float(i),float(j))*d));
  return s/9.0;
}
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res,A=M_asp();
  float k=min(W_drive(),1.2);
  float l=pow(W_lb(q),0.5);
  vec3 img=W_src(q);
  vec3 col=vec3(luma(img))*u_a1*0.28+img*0.06;
  // Lines pass each pixel at (drift x major) per loop; the limiter bounds that to 3 per second, in whole major steps.
  float lim=u_safe>0.5?3.0*u_L:1.0e4;
  float dft=sign(float(p_drift))*floor(min(float(abs(p_drift)*p_major),lim)/float(p_major))*float(p_major);
  float x=l*float(p_levels)-dft*u_p;
  float fw=fwidth(x)+1e-4,fr=fract(x),dd=min(fr,1.0-fr);
  float maj=step(mod(floor(x+0.5),float(p_major)),0.5);
  float ln=1.0-smoothstep(0.0,fw*(1.4+maj*1.4),dd);
  vec3 lc2=mix(u_a1,u_a0,smoothstep(0.1,0.7,l));
  float ang=atan(uv.y,uv.x);
  float sw=fract(-ang/TAU-safeCycles(float(p_sweeps))*u_p);
  float trail=exp(-sw*p_trail);
  col+=lc2*ln*(0.35+1.6*trail+0.6*k+0.5*maj);
  if(p_rings){
    float r5=length(uv)*5.0,rr=fract(r5);
    col+=u_a1*0.1*(1.0-smoothstep(0.0,fwidth(r5)*1.3,min(rr,1.0-rr)));
  }
  if(p_showReticle){
    vec2 ret=v_reticle(),dv=uv-ret;
    float rd=length(dv);
    float crs=max(line(abs(dv.x),0.002)*step(abs(dv.y),0.06)*step(0.02,abs(dv.y)),line(abs(dv.y),0.002)*step(abs(dv.x),0.06)*step(0.02,abs(dv.x)));
    float ringc=line(abs(rd-0.028),0.003);
    col+=u_a1*1.6*(crs+ringc);
    if(rd<0.2){   // the level readout only samples near the reticle, so the other pixels skip nine reads
      float lvl=pow(W_lb(ret/A+0.5),0.5)*99.0;
      col+=u_ink*1.4*W_num(uv,ret+vec2(0.045,0.012),0.026,lvl,2);
    }
  }
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
