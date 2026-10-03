// Ten related treatments sharing the same partition map.
vec4 motif(vec2 uv,vec2 fc){
 vec2 q=fc/u_res;
 vec4 map=texture(u_buf1,q);
 float id=map.r,dist=map.g*12.0;
 vec2 off=(map.ba-0.5)*2.0*p_amount;
 float border=K_edge(dist,p_edge);
 vec2 sq=clamp(q+off*vec2(1.4,1.0),vec2(0.0),vec2(1.0));
 vec3 src=K_source(sq).rgb;
 vec3 col=src;
 float ink=p_ink;
 if(p_variant==0){ // Kinetic Treemap
   col=mix(src,u_ink,border*ink);
 }else if(p_variant==1){ // Mondrian Drift
   float seam=K_edge(dist,p_edge*2.7);
   float accent=step(0.87,h11(floor(id*255.0)+5.0));
   col=mix(src,u_bg,seam*0.96);
   col=mix(col,u_a0,accent*0.26*(1.0-seam));
 }else if(p_variant==2){ // Barcode Cathedral
   float band=step(0.77,h11(floor(id*255.0)+13.0));
   vec2 bq=vec2(mix(sq.x,floor(sq.x*150.0)/150.0,band*0.9),sq.y);
   col=K_source(bq).rgb;
   col=mix(col,u_bg,step(0.96,h11(floor(id*255.0)+41.0))*0.79);
   col=mix(col,u_ink,border*ink*0.65);
 }else if(p_variant==3){ // Scanline Fault
   float scan=0.94+0.06*sin(fc.y*PI);
   col=src*scan;
   col=mix(col,u_a0,step(0.88,h11(floor(id*255.0)+17.0))*0.22);
   col=mix(col,u_ink,border*ink*0.7);
 }else if(p_variant==4){ // Chromatic Register
   float shift=0.004+p_smear*0.024;
   vec3 r=K_source(sq+vec2(shift,0.0)).rgb;
   vec3 b=K_source(sq-vec2(shift,0.0)).rgb;
   col=vec3(r.r,src.g,b.b);
   col=mix(col,u_ink,border*ink*0.65);
 }else if(p_variant==5){ // Monolith Cut
   float dark=step(0.83,h11(floor(id*255.0)+53.0));
   col=mix(src,u_bg,dark*0.97);
   col=mix(col,u_ink,border*ink*0.8);
 }else if(p_variant==6){ // Offset Press
   float grey=luma(src);
   vec3 duotone=mix(u_bg,u_a0,smoothstep(0.08,0.95,grey));
   col=mix(src,duotone,0.52);
   col=mix(col,u_bg,border*ink);
 }else if(p_variant==7){ // Signal Cascade
   vec2 smearQ=vec2(mix(sq.x,floor(sq.x*105.0)/105.0,p_smear*0.8),sq.y);
   col=K_source(smearQ).rgb*(0.94+0.06*sin(fc.y*2.0*PI));
   col=mix(col,u_a0,step(0.9,h11(floor(id*255.0)+71.0))*0.3);
   col=mix(col,u_ink,border*ink*0.75);
 }else if(p_variant==8){ // Survey Grid
   col=mix(src,u_ink,border*ink);
   float ticks=step(0.985,h21(floor(fc/vec2(9.0))+floor(id*100.0)));
   col=mix(col,u_a0,ticks*0.24);
 }else{ // Afterimage Atlas
   vec3 echoA=K_source(clamp(sq+off*0.9+vec2(0.01,0.0),vec2(0.0),vec2(1.0))).rgb;
   vec3 echoB=K_source(clamp(sq-off*0.45-vec2(0.005,0.0),vec2(0.0),vec2(1.0))).rgb;
   col=mix(src,(echoA+echoB)*0.5,0.4);
   col=mix(col,u_ink,border*ink*0.65);
 }
 // Compact corner notation. Source image is always sampled in linear light.
 if(p_variant==0||p_variant==8){float tick=step(0.88,h21(floor(fc/vec2(12.0))+floor(id*100.0)));col=mix(col,u_ink,tick*border*0.2);}
 return vec4(max(col,vec3(0.0)),1.0);
}
