// Wallcast shared GLSL (motif-kit@1, SDK 1.2).
// Every style declares the shared params beats, hitAmt, hit, exposure, vignette, hud and readout,
// so the helpers below compile in every pass of every style. The kit-level media input "source"
// gives u_source, u_sourceOn and m_source(q).

// ---- source -------------------------------------------------------------------------------
// The attached media composited on the palette background, or the procedural fallback (pass 0).
vec3 W_src(vec2 q){
  q=clamp(q,vec2(0.0),vec2(1.0));
  if(u_sourceOn>0.5){vec4 s=m_source(q);return s.rgb+u_bg*(1.0-s.a);}
  return texture(u_buf0,q).rgb;
}

// ---- beat ---------------------------------------------------------------------------------
// Loop-locked kick envelope. Pulses per loop pass through the photosensitive limiter, so the
// rate never exceeds 3 per second while the limiter is on.
float W_beat(){
  float r=safeCycles(float(p_beats));
  if(r<1.0) return 0.0;
  float f=fract(u_p*r);
  return 1.25*smoothstep(0.0,0.04,f)*exp(-f*5.0);
}
// Internal beat times Beat drive, plus the Hit param (map a live kick band to it).
float W_drive(){return clamp(W_beat()*p_hitAmt+p_hit,0.0,1.5);}

// ---- seven-segment numerals (data readouts, drawn in the shader) ----------------------------
float W_box(vec2 p,vec2 c,vec2 h){vec2 d=abs(p-c)-h;return step(max(d.x,d.y),0.0);}
float W_digit(vec2 p,int d){
  const int M[10]=int[10](63,6,91,79,102,109,125,7,127,111);
  int m=M[clamp(d,0,9)];
  float t=0.09,s=0.0;
  if((m&1)!=0)  s+=W_box(p,vec2(0.5,1.9),vec2(0.36,t));
  if((m&2)!=0)  s+=W_box(p,vec2(0.9,1.45),vec2(t,0.38));
  if((m&4)!=0)  s+=W_box(p,vec2(0.9,0.55),vec2(t,0.38));
  if((m&8)!=0)  s+=W_box(p,vec2(0.5,0.1),vec2(0.36,t));
  if((m&16)!=0) s+=W_box(p,vec2(0.1,0.55),vec2(t,0.38));
  if((m&32)!=0) s+=W_box(p,vec2(0.1,1.45),vec2(t,0.38));
  if((m&64)!=0) s+=W_box(p,vec2(0.5,1.0),vec2(0.36,t));
  return min(s,1.0);
}
// value drawn as n digits with its lower-left corner at o and digit height h (uv units).
float W_num(vec2 uv,vec2 o,float h,float value,int n){
  vec2 p=(uv-o)/h*2.0;
  float adv=1.4,ix=floor(p.x/adv);
  if(ix<0.0||ix>=float(n)||p.y<0.0||p.y>2.0) return 0.0;
  vec2 lp=vec2(p.x-ix*adv,p.y);
  if(lp.x>1.0) return 0.0;
  float mx=1.0; for(int i=0;i<4;i++){ if(i>=n) break; mx*=10.0; }
  float pw=1.0; for(int i=0;i<3;i++){ if(float(i)>=float(n)-1.0-ix) break; pw*=10.0; }
  float v=floor(clamp(value,0.0,mx-1.0)+0.5);
  return W_digit(lp,int(mod(floor(v/pw),10.0)));
}

// ---- HUD frame: corner brackets, numeric readout, beat trace with playhead ---------------------
vec3 W_hud(vec2 uv){
  if(!p_hud) return vec3(0.0);
  vec2 A=M_asp(),e=A*0.5;
  float m=0.04,th=max(aa()*0.8,0.0012),L=0.05;
  vec2 corner=e-vec2(m),d=abs(uv)-corner;
  float br=max(step(abs(d.y),th)*step(-L,d.x)*step(d.x,th),step(abs(d.x),th)*step(-L,d.y)*step(d.y,th));
  vec3 col=u_ink*0.85*br;
  col+=u_a0*1.4*W_num(uv,vec2(-corner.x+0.02,-corner.y+0.02),0.032,p_readout,4);
  float wd=0.17,ht=0.045;
  vec2 t0=vec2(corner.x-0.02-wd,-corner.y+0.02);
  vec2 g=(uv-t0)/vec2(wd,ht);
  if(g.x>=0.0&&g.x<=1.0&&g.y>=-0.3&&g.y<=1.4){
    float env=1.25*smoothstep(0.0,0.04,g.x)*exp(-g.x*5.0);
    float ln=1.0-smoothstep(th*0.8,th*1.7,abs(uv.y-(t0.y+env*ht*0.8)));
    float r=safeCycles(float(p_beats));
    float ph=r<1.0?0.0:fract(u_p*r);
    float head=(1.0-smoothstep(th*0.6,th*1.5,abs(g.x-ph)*wd))*step(0.0,g.y)*step(g.y,1.0);
    col+=u_a1*(ln*1.2+head*0.5);
  }
  return col;
}

// ---- finish: exposure and vignette ------------------------------------------------------------
vec3 W_finish(vec3 col,vec2 uv){
  vec2 h=M_asp()*0.5;
  float v=dot(uv,uv)/dot(h,h);
  return max(col*p_exposure*(1.0-p_vignette*0.6*v),vec3(0.0));
}
