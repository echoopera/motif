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
float sheet=sin(q.y*1.8 + .95*sin(q.x*.7-ph) + .75*cos(q.z*.65+ph) + .8);
float d=.015+abs(sheet)*.45/p_width;
float weave=.65+.35*cos(q.x*1.7+q.z*.8);
d*=weave;

  float hue=.5+.5*sin(q.z*.3+q.x*.45-ph);
  vec3 ink=mix(u_a0,u_a1,hue);
  ink=mix(ink,u_a2,.22+.18*sin(q.y*.5));
  float pulse=1.+p_breath*.2*sin(ph+q.z*.55);
  col += sc*ink*exp(-z*p_depth)*(.00065*p_radiance*pulse/d);
  z+=clamp(d,.025,.42)*sc;
 }
 col=1.-exp(-col);
 return vec4(col,1.);
}
