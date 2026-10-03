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
c=vec3(.93,.9,.68);vec2 v=rot(.2)*q;float stripe=step(.5,fract(v.x*40.));c=mix(c,vec3(.015),stripe*step(v.y,-.24));float wave=.16*sin(q.x*29.+t)+.07*sin(q.x*61.-t);float cut=step(q.y,wave+.27)*step(wave-.02,q.y);c=mix(c,vec3(.94,.015,.01),cut);float circle=length(q-vec2(-.07,.0));float bands=step(.54,fract(circle*19.+q.x*2.));c=mix(c,vec3(.01),bands*step(circle,.58)*step(.25,circle));float bar=step(abs(v.x+.18),.095)*step(abs(v.y),.73);c=mix(c,vec3(.01),bar);float y=step(.36,v.x)*step(v.y,.76);c=mix(c,vec3(.95,.91,.015),y);return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}