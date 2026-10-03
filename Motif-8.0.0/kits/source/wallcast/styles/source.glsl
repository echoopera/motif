// Fallback image, used when no media is attached (library thumbnails, SDK preview) and skipped otherwise.
// A night skyline, a striped sun and a floor grid, all in the palette.
vec4 motif(vec2 uv,vec2 fc){
  if(u_sourceOn>0.5) return vec4(0.0,0.0,0.0,1.0);
  vec2 A=M_asp(),p=uv;
  float y=p.y,ground=-0.13;
  vec3 col=u_bg*0.8;
  col+=u_a0*0.16*exp(-abs(y-ground)*4.5);
  col+=u_a1*0.04*smoothstep(-0.1,0.5,y);
  col+=u_ink*step(0.9985,h21(floor(fc/vec2(3.0))))*step(0.04,y)*0.7;
  // striped sun
  vec2 c=vec2(A.x*0.12,0.07);
  float r=length(p-c);
  float gap=smoothstep(0.0,1.0,(c.y-p.y)/0.2);
  float stripe=(p.y>c.y-0.01)?1.0:step(gap*0.75,fract(p.y*30.0));
  vec3 sun=mix(u_a2,u_a0,sat((p.y-(c.y-0.2))/0.4));
  col+=u_a0*0.16*exp(-r*5.0);
  col=mix(col,sun*1.5,(1.0-smoothstep(0.2,0.204,r))*stripe);
  col+=u_a1*0.35*line(abs(r-0.29),0.003);
  // skyline with lit windows
  float bw=0.04,x=p.x+A.x*0.5,id=floor(x/bw),fx=fract(x/bw);
  float top=ground+0.04+0.32*pow(h11(id+3.0),1.6);
  if(y<top&&y>ground){
    vec3 b=u_bg*0.35+u_a1*0.02;
    float wy=(y-ground)/0.018;
    vec2 wid=vec2(floor(fx*3.0),floor(wy));
    float lit=step(0.62,h21(wid+vec2(id*7.0,1.0)));
    float inner=step(0.18,fract(fx*3.0))*step(0.25,fract(wy));
    b+=mix(u_a0,u_a2,h21(wid+vec2(id,5.0)))*lit*inner*0.9;
    b+=u_a1*0.3*exp(-(top-y)*260.0);
    col=b;
  }
  // floor grid
  if(y<=ground){
    float dy=ground-y,z=1.0/(dy+0.03);
    float gx=abs(fract(p.x*z*0.35)-0.5);
    float vl=1.0-smoothstep(0.0,0.05+0.0004*z*z,0.5-gx);
    float hl=smoothstep(0.86,1.0,fract(z*0.7));
    col=u_bg*0.7+u_a1*0.32*max(vl,hl)*smoothstep(0.0,0.06,dy)*exp(-dy*2.2);
    col+=u_a0*0.12*exp(-dy*14.0);
  }
  return vec4(max(col,vec3(0.0)),1.0);
}
