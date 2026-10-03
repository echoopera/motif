// field-class: density. Fixed-step, step-normalised absorption/emission; no sphere tracing.
// Per-pixel IGN start jitter turns step slicing into fine noise; the camera circles on a path that never crosses the sheet, so the loop has no flip.
float vapor(vec3 q,float ph){q.x+=.5*sin(q.z*.28+ph);q.y+=.3*cos(q.z*.41-ph);float n=vaporNoise(q*p_scale,ph);
float c=smoothstep(-.15,.95,n)*exp(-abs(q.y)*.30);float ridge=exp(-abs(q.y+.4*sin(q.x*.8+q.z*.4)+n*.4)*4.);return c*.58+ridge*.30;
}
vec4 motif(vec2 uv,vec2 fc){float ph=kPhase();vec3 ray=normalize(vec3(uv*1.6,1.));
vec3 ro=vec3(.4*cos(ph),1.5+.06*sin(ph),0.);float trans=1.;vec3 col=u_bg*.35;float ds=p_depth/float(p_steps);float jit=kIgn(fc);
vec3 hero=kMix(u_a0,u_a1,.28);vec3 shadow=kMix(u_bg,u_a2,.18);
for(int i=0;i<80;i++){if(i>=p_steps)break;float z=.5+(float(i)+jit)*ds;vec3 q=ro+ray*z;
float den=max(vapor(q,ph),0.)*p_density;float denL=max(vapor(q+vec3(-.32,.46,-.18),ph),0.)*p_density;
float lightFace=clamp(den-denL,0.,1.);float alpha=1.-exp(-den*ds*.82);
vec3 ink=shadow*.3+hero*(.06+.9*lightFace)+u_ink*pow(lightFace,2.)*p_membrane*1.7;
float mistGlow=pow(max(.5+.5*sin(q.z*.45+ph),0.),4.)*.15;
col+=trans*(ink+hero*mistGlow)*alpha*p_radiance*1.15;trans*=1.-alpha;
}
col+=trans*u_a1*.04;
// Focal point: brightest region sits just right of centre, the frame falls away from it.
vec2 f=uv-vec2(.15,.05);col*=.55+.75*exp(-dot(f,f)*1.3);
return vec4(col,1.);}
