// Prism Split: radial chromatic split plus anamorphic light streaks. The kick pushes the channels apart
// and stretches the highlights. Sweeps and every periodic term use integer cycles per loop.
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res,A=M_asp();
  float k=W_drive();
  float d=length(uv)/length(A*0.5);
  float amt=p_split*(0.25+1.4*k)*(0.35+d*1.8);
  vec2 dir=normalize(uv+vec2(1e-4))/A;
  vec3 col=vec3(W_src(q+dir*amt).r,W_src(q).g,W_src(q-dir*amt).b);
  if(p_spectral){
    vec3 acc=vec3(0.0);
    for(int i=0;i<7;i++){
      float t=float(i)/6.0;
      vec3 w=0.5+0.5*cos(TAU*(t+vec3(0.0,0.33,0.67)));
      acc+=W_src(q+dir*amt*(t*2.0-1.0)*1.4)*w;
    }
    col=mix(col,acc*2.0/7.0,0.4);
  }
  vec3 st=vec3(0.0);
  float len=p_streakLen*(0.4+0.6*min(k,1.0));
  for(int i=-12;i<=12;i++){
    float x=float(i)/12.0;
    vec3 s=max(W_src(q+vec2(x*len,0.0))-0.25,vec3(0.0));
    st+=s*exp(-abs(x)*3.5);
  }
  st/=8.0;
  col+=st*u_a0*1.6*p_streak*(0.7+1.3*k);
  col+=st.bgr*u_a1*0.8*p_streak*p_streakCool;
  if(safeCycles(float(p_sweeps))>=1.0){
    float c=lsaw(safeCycles(float(p_sweeps)),0.0);
    col+=u_a0*0.35*exp(-abs(q.x-c)*40.0)*sin(PI*c);
  }
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
