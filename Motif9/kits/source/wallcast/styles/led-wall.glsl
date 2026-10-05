// LED Wall: a pixel-mapped panel. Cell grid, RGB sub-pixel stripes, cell gap, bloom, a scan wipe and time-slotted
// sparkle (through the limiter). Cells high sets the panel pitch.
vec4 motif(vec2 uv,vec2 fc){
  vec2 q=fc/u_res,A=M_asp();
  float k=W_drive();
  float N=float(p_cells);
  vec2 grid=N*A,p=q*grid,id=floor(p),f=fract(p)-0.5;
  vec2 cu=(id+0.5)/grid;
  vec3 c=W_src(cu);
  float x=f.x+0.5;
  vec3 sp=vec3(smoothstep(0.3,0.05,abs(x-0.2)),smoothstep(0.3,0.05,abs(x-0.5)),smoothstep(0.3,0.05,abs(x-0.8)));
  float box=p_shape==1?length(f)*1.1:max(abs(f.x),abs(f.y));
  float edge=mix(0.5,0.3,p_gap);
  float mask=1.0-smoothstep(edge-0.1,edge,box);
  vec3 led=mix(c,c*sp*2.4,p_subpixel*0.8)*mask;
  vec3 bl=vec3(0.0);
  for(int i=0;i<8;i++){
    float a=float(i)*0.7854;
    bl+=W_src(cu+vec2(cos(a)/A.x,sin(a))*0.018);
  }
  bl/=8.0;
  float wipe=0.0;
  if(safeCycles(float(p_wipes))>=1.0){
    float t=lsaw(safeCycles(float(p_wipes)),0.0);
    wipe=exp(-abs(q.y-t)*28.0)*sin(PI*t);
  }
  float spark=step(0.992,h21(id+vec2(tslot(24.0),0.0)))*p_sparkle;
  float rowP=0.5+0.5*lsin(1.0,id.y/max(grid.y,1.0));
  vec3 col=led*(1.05+0.7*min(k,1.2)+0.12*rowP)+bl*p_bloom*(0.5+0.5*min(k,1.0));
  col+=(c+0.2)*wipe*0.5*mask+spark*u_a2*1.2*mask;
  col=W_finish(col,uv)+W_hud(uv);
  return vec4(col,1.0);
}
