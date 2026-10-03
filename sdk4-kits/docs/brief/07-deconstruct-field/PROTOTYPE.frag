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
c=vec3(.89,.88,.81);vec2 v=rot(-.27)*q;for(int i=0;i<24;i++){float f=float(i);vec2 p=v-vec2((hash(f)-.5)*.75+.025*sin(t+f),(hash(f+71.)-.5)*1.6+.04*cos(t+f));float w=.025+hash(f+10.)*.10;float h=.08+hash(f+20.)*.38;float d=max(abs(p.x)-w,abs(p.y)-h);vec3 col=i%3==0?vec3(.02,.16,.72):(i%3==1?vec3(.8,.03,.025):vec3(.01,.015,.02));c=mix(c,col,stroke(d,0.));float grid=stroke(abs(fract(p.x*95.)-.5)/95.,.0007);c=mix(c,vec3(.08),grid*.20*step(abs(p.y),h+.07)*step(abs(p.x),w+.06));}float arc=abs(length(q-vec2(.12,-.15))-.37);c=mix(c,vec3(.025,.18,.75),stroke(arc,.05)*step(-.1,q.x));return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}