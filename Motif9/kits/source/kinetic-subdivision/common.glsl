// Kinetic Subdivision shared GLSL (motif-kit@1, SDK 1.1 media inputs).
// The runtime declares u_source / u_sourceOn and m_source(q) from the manifest's "inputs".
float K_mix(float a,float b,float t){return mix(a,b,t);}
// Attached media composited over the palette background (transparent pixels and letterbox bars),
// blended with the procedural fallback by Media mix. With no media attached, the fallback plays.
vec4 K_source(vec2 q){
  q=clamp(q,vec2(0.0),vec2(1.0));
  vec4 s=m_source(q);
  vec4 img=vec4(s.rgb+u_bg*(1.0-s.a),1.0);
  float k=p_imageMix*u_sourceOn;
  if(k>0.999) return img;
  return mix(texture(u_buf0,q),img,k);
}
float K_edge(float d,float w){return 1.0-smoothstep(w*0.35,w*1.6,d);}
