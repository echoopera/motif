// Astral 1.1: oriented loop motion; integer phase windings preserve the seam.
mat2 astralRot(float a) { float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
vec3 astralFold(vec3 q, float phase) {
 float f=1.;
 for(int j=0;j<5;j++) {
  if(j>=p_detail) break;
  // Traveling folds, rather than a single oscillator moving the entire field.
  float winding=safeCycles(float(j+1)); // whole windings; the photosensitive limiter caps the rate on very short loops
  vec3 travel=vec3(phase*winding,-phase*winding,phase*winding+1.2);
  q += p_distortion*(abs(cos(q.yzx*f+travel)) - p_foldBias)/f;
  f*=2.;
 }
 return q;
}
float astralPhase(){return TAU*fract(u_p)*safeCycles(1.);} // loops too short for the 3/s limit hold still when the limiter is on
float kIgn(vec2 fc){return fract(52.9829189*fract(dot(fc,vec2(.06711056,.00583715))));}
