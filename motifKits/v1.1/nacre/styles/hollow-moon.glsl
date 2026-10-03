// field-class: implicit membrane contours with analytic surface shading and heuristic glow.
// Stateless ecology: seeded cyclic birth, division and drift. No persistent reaction-diffusion claim.
vec3 organism(vec2 q,float ph,float salt){kPq=length(dFdx(q));float r=length(q),a=atan(q.y,q.x);
float shape=1.+.08*p_complexity*sin(a*4.-ph);float rim=kBell(r-shape,.035*p_membrane)+.55*kBell(r-.63,.032*p_membrane);float body=(1.-smoothstep(.96,1.04,r))*smoothstep(.35,.65,r);float core=kBell(length(q-vec2(.25,.1))-.20,.04);
float fold=pow(.5+.5*sin(a*(5.+floor(p_complexity*5.))+r*8.-ph+salt),4.)*body;
float dome=sqrt(max(0.,1.-r*r));vec3 normal=normalize(vec3(q*.55,dome+.3));float key=.3+.7*max(dot(normal,normalize(vec3(-.5,.7,1.))),0.);
vec3 pigment=kMix(u_a0,u_a2,.35+.25*sin(salt+r*3.));float fresnel=pow(1.-clamp(normal.z,0.,1.),3.);
return pigment*body*key*.16+u_ink*rim*(1.15+.8*fresnel)+u_a1*core*1.25+pigment*fold*.12;}
vec4 motif(vec2 uv,vec2 fc){float ph=kPhase();vec3 col=u_bg+u_a2*.03*exp(-dot(uv,uv)*1.2);
for(int i=0;i<42;i++){if(i>=p_population)break;float fi=float(i);float salt=TAU*h11(fi+31.+141.);vec2 h=h22(vec2(fi,19.+141.));
float cycle=fract(h11(fi+3.+141.)+fract(u_p)*float(p_cycles));float z=.9+cycle*p_depth;float fade=smoothstep(0.,.12,cycle)*(1.-smoothstep(.78,1.,cycle));
vec2 center=(h-.5)*vec2(10.,6.)*p_density/z;center+=vec2(cos(ph+salt),sin(ph+salt))*.075/z;
vec2 q=kRot(ph+salt)*(uv*p_scale-center)*z*(1.35+.45*h11(fi+8.+141.));float life=.78+.22*sin(ph+salt);
q/=life;vec3 ink=organism(q,ph,salt);
vec2 cc=center*z/vec2(5.,3.);col+=ink*fade*exp(-z*.16)*(.55+.9*exp(-dot(cc,cc)*1.3))*p_radiance;
}
return vec4(col,1.);}
