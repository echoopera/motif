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
c=vec3(.004,.012,.015);for(int j=0;j<14;j++)for(int i=0;i<14;i++){float x=float(i),y=float(j);vec3 p=vec3((x-6.5)*.1,(y-6.5)*.1,.18*sin(x*.5+y*.6+t));p.xz*=rot(.55+.2*sin(t));p.yz*=rot(-.3);float dispersal=smoothstep(-.2,.5,p.x);p.xy+=dispersal*.13*vec2(sin(x*12.+y+t),cos(y*19.+x-t));vec2 pt=p.xy/(1.4+p.z);float d=length(q-pt);vec3 col=mix(ice,vec3(.75,1.,.05),hash(x*17.+y));c+=col*exp(-d*d/.000013)*1.3;float a=hash(x*8.+y);vec2 other=pt+.055*vec2(cos(a*TAU+t),sin(a*TAU+t));c+=ice*stroke(line(q,pt,other),.0007)*.3*(1.-dispersal*.6);}vec2 v=q*rot(.3);float poly=abs(max(abs(v.x)*.8+abs(v.y)*.55,abs(v.y)*.95)-.38);c+=ice*exp(-poly*300.)*.8;return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}