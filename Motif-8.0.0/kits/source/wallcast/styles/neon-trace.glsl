// Neon Trace: three Sobel scales drawn as light, coloured by a palette that cycles a whole number of times per loop
// and gated by a travelling band.
float W_l(vec2 q){return luma(W_src(q));}
float W_sob(vec2 q,float px){
  vec2 d=px/u_res;
  float tl=W_l(q+vec2(-d.x,d.y)),t=W_l(q+vec2(0.0,d.y)),tr=W_l(q+d),l=W_l(q+vec2(-d.x,0.0)),r=W_l(q+vec2(d.x,0.0)),bl=W_l(q-d),b=W_l(q-vec2(0.0,d.y)),br=W_l(q+vec2(d.x,-d.y));
  float gx=-tl-2.0*l-bl+tr+2.0*r+br,gy=-tl-2.0*t-tr+bl+2.0*b+br;
  return length(vec2(gx,gy));
}
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res;
  float k=min(W_drive(),1.2);
  float e=W_sob(q,p_width),e2=W_sob(q,4.0*p_spread),e3=W_sob(q,10.0*p_spread);
  float line2=smoothstep(0.03,0.45,pow(e,0.7)*1.4);
  float glow=e2*0.6+e3*0.35;
  float l=pow(W_l(q),0.5);
  float ph=q.x*p_hueSpan+q.y*p_hueSpan*0.5+l*0.5*p_hueSpan+safeCycles(float(p_hueCycles))*u_p;
  vec3 pal;
  if(p_colorMode==0){
    pal=0.5+0.5*cos(TAU*(vec3(0.0,0.33,0.67)+ph));
    pal*=pal;
  }else if(p_colorMode==1){
    vec3 w=0.5+0.5*cos(TAU*(vec3(ph)-vec3(0.0,0.3333,0.6667)));
    pal=(u_a0*w.x+u_a1*w.y+u_a2*w.z)/(w.x+w.y+w.z+1e-4)*1.3;
  }else{
    pal=u_ink;
  }
  float band=1.0;
  if(safeCycles(float(p_gate))>=1.0){
    float c=lsaw(safeCycles(float(p_gate)),0.0)*1.4-0.2;
    band=1.0+1.6*exp(-pow((q.x-c)*5.0,2.0));
  }
  vec3 col=W_src(q)*p_base+pal*(line2*1.3+glow*p_glow*(0.6+1.2*k))*band;
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
