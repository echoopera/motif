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
c=vec3(.006,.025,.025);q-=vec2(-.12,.12);q=rot(t)*q;float r=length(q);for(int i=0;i<180;i++){float n=float(i);float a=n*2.39996323;float rr=.047*sqrt(n);vec2 center=rr*vec2(cos(a),sin(a));vec2 v=rot(-a-.6)* (q-center);float len=.043+.042*rr;float d=length(v/vec2(len,.012+.018*rr));float pet=1.-smoothstep(.84,1.,d);float ridge=exp(-abs(v.y)*140.)*(1.-smoothstep(.7,1.,abs(v.x)/len));vec3 material=mix(vec3(.16,.1,.035),vec3(.94,.85,.58),clamp(v.y*20.+.55,0.,1.));c=mix(c,material,pet*.94);c+=gold*ridge*pet*.7;float edge=exp(-abs(d-.92)*60.);c+=gold*edge*.33;}c+=gold*.03/max(r,.03);return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}