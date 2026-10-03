vec4 motif(vec2 uv, vec2 fc) {
 float ph=astralPhase(); // Forward normalized loop phase, never triangle/ping-pong.
 vec3 ray=normalize(vec3(uv*2.1,1.));
 // View stays stable; the light field circulates in one direction.
 vec3 ro=vec3(0.);
 vec3 col=vec3(0.);
 float sc=64./float(p_samples);float z=.12+kIgn(fc)*.06*sc; // sc keeps exposure and reach constant across Ray samples; IGN start jitter hides step slicing
 for(int k=0;k<96;k++) {
  if(k>=p_samples) break;
  vec3 q=ro+z*ray;
  q.xy=astralRot(ph + q.z*.13*p_twist)*q.xy;
  // Breathing is local traveling radiance, not global zoom reversal.
  
  q=astralFold(q,ph);
float density=1.;
vec3 cell=mod(q+1.5,3.)-1.5;
float node=length(cell)-.32;
float wire=min(length(cell.xy),min(length(cell.yz),length(cell.xz)))-.055;
float d=.014+abs(min(node,wire))*.3/p_width;
density=.6+.4*pow(.5+.5*sin(ph-q.z*.85),2.);
  float hue=.5+.5*sin(q.z*.3+q.x*.45-ph);
  vec3 ink=mix(u_a0,u_a1,hue);
  ink=mix(ink,u_a2,.22+.18*sin(q.y*.5));
  float pulse=1.+p_breath*.2*sin(ph+q.z*.55);
  col += sc*ink*exp(-z*p_depth)*(.00065*p_radiance*pulse*density*1.20/d);
  z+=clamp(d,.025,.42)*sc;
 }
 col=1.-exp(-col);
 return vec4(col,1.);
}
