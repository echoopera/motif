// Stable BSP topology; split positions and cell offsets interpolate between loop slots.
// R cell id, G edge distance / 12 px, BA encoded displacement vector.
vec4 motif(vec2 uv,vec2 fc){
 vec2 q=fc/u_res,lo=vec2(0.0),hi=vec2(1.0);
 float id=u_seed+1.0,dist=1e5;
 float rate=safeCycles(float(p_rate));
 float ph=rate<1.0?0.0:fract(u_p)*rate;
 float slot=floor(ph),nextSlot=rate<1.0?0.0:mod(slot+1.0,rate);
 float fraction=fract(ph);
 float t=p_smoothness<0.001?0.0:sat(fraction/max(0.001,p_smoothness));
 t=t*t*(3.0-2.0*t);
 for(int i=0;i<7;i++){
   if(i>=p_depth)break;
   float level=float(i),base=id*1.13+level*17.0;
   bool vertical=p_variant==2?true:(p_variant==3||p_variant==7?false:(p_variant==1?mod(level,3.0)!=1.0:h11(id*2.17+level*31.0)>0.42));
   float a=h21(vec2(base,slot)),b=h21(vec2(base,nextSlot));
   float ratio=clamp(0.5+(mix(a,b,t)-0.5)*0.48,0.24,0.76);
   if(vertical){float x=mix(lo.x,hi.x,ratio);dist=min(dist,abs(q.x-x)*u_res.x);if(q.x<x){hi.x=x;id=id*2.31+1.0;}else{lo.x=x;id=id*2.31+2.0;}}
   else{float y=mix(lo.y,hi.y,ratio);dist=min(dist,abs(q.y-y)*u_res.y);if(q.y<y){hi.y=y;id=id*2.71+1.0;}else{lo.y=y;id=id*2.71+2.0;}}
 }
 dist=min(dist,min(min((q.x-lo.x)*u_res.x,(hi.x-q.x)*u_res.x),min((q.y-lo.y)*u_res.y,(hi.y-q.y)*u_res.y)));
 vec2 va=h22(vec2(id*5.31,slot)),vb=h22(vec2(id*5.31,nextSlot));
 vec2 off=(mix(va,vb,t)-0.5)*2.0;
 return vec4(h11(id*1.47),sat(dist/12.0),off*0.5+0.5);
}
