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
c=vec3(.009,.006,.025);float r=length(q-vec2(.08,.16));float a=atan(q.y-.16,q.x-.08);for(int i=0;i<36;i++){float z=float(i)/36.;float edge=.10+z*.93+.045*sin(a*5.+z*12.+t)+.03*sin(a*11.-z*15.-t);float d=abs(r-edge);vec3 col=mix(vec3(.34,.04,.95),vec3(.15,.65,1.),.5+.5*sin(z*8.+a));c+=col*exp(-d*(180.+z*90.))*.25;c+=col*exp(-d*26.)*.033;float strands=pow(max(0.,sin(a*65.+r*80.+z*31.)),24.);c+=col*strands*exp(-d*90.)*.15;}c*=smoothstep(.075,.22,r);return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}