#version 300 es
precision highp float;
uniform vec2 u_res;uniform float u_p;out vec4 frag;
#define PI 3.14159265359
#define TAU 6.28318530718
float hash(float n){return fract(sin(n*127.1)*43758.5453);}
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
float line(vec2 p,vec2 a,vec2 b){vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/max(dot(d,d),.0001),0.,1.));}
float stroke(float d,float w){return 1.-smoothstep(w,w+2./u_res.y,d);}
vec3 gold=vec3(1.,.65,.23),ice=vec3(.3,.65,1.);
vec3 shade(vec2 q,float t){vec3 c=vec3(0.);
c=vec3(.006,.035,.027);vec2 x=q*5.;vec2 id=floor(x);float f1=9.,f2=9.;vec2 winner=vec2(0.);float seed=0.;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=id+vec2(i,j);float h=hash(dot(g,vec2(17.,93.)));vec2 center=g+.5+.27*vec2(sin(h*TAU+t),cos(h*37.+t));float d=length(x-center);if(d<f1){f2=f1;f1=d;winner=center;seed=h;}else if(d<f2){f2=d;}}float membrane=exp(-(f2-f1)*50.);c+=vec3(.12,.62,.45)*membrane*.7;vec2 local=x-winner;float rr=length(local);float ang=atan(local.y,local.x);float outer=1.-smoothstep(.34,.4,rr);vec3 col=mix(vec3(.1,.62,.48),vec3(1.,.32,.08),step(.7,seed));c+=col*outer*.07;c+=col*exp(-abs(rr-.34)*95.)*.7;float fil=pow(max(0.,sin(ang*24.+sin(rr*32.-t)*1.2)),10.);c+=col*fil*outer*.6*smoothstep(.025,.16,rr);c+=gold*exp(-rr*27.)*.8;return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}