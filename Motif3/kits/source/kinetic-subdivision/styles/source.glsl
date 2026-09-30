// Fallback procedural image, used when no media is attached to the layer (and for library thumbnails).
vec4 motif(vec2 uv,vec2 fc){
 if(u_sourceOn*p_imageMix>0.999) return vec4(0.0,0.0,0.0,1.0); // media fully replaces this pass
 vec2 q=fc/u_res;
 float stripe=sin(q.y*24.0+sin(q.x*12.0)*1.5);
 float block=step(0.48,fract(q.y*3.0+q.x*0.7));
 vec3 col=mix(u_bg,u_a0,0.23+0.4*block);
 col=mix(col,u_ink,(1.0-smoothstep(0.0,0.1,abs(q.x-0.35)))*0.42);
 col+=u_a1*max(0.0,stripe)*0.07;
 float band=1.0-smoothstep(0.0,0.02,abs(q.y-0.52));
 col=mix(col,u_a2,band*0.65);
 return vec4(max(col,vec3(0.0)),1.0);
}
