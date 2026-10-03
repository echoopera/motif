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
c=vec3(.008,.02,.045);for(int j=0;j<7;j++){float f=float(j);vec2 v=q*rot(.25*sin(t)+f*.17);float r=.13+f*.106;float ring=abs(length(v)-r);c+=gold*exp(-ring*400.)*.5+gold*exp(-ring*40.)*.025;for(int i=0;i<8;i++){float a=TAU*float(i)/8.;vec2 x=r*vec2(cos(a),sin(a));vec2 y=r*vec2(cos(a+PI*.75),sin(a+PI*.75));float d=line(v,x,y);c+=gold*stroke(d,.0012)*.38;c+=ice*exp(-length(v-x)*90.)*.25;}}float diamond=abs(abs(q.x)+abs(q.y*.8)-.22);c+=ice*exp(-diamond*180.)*.55;float g=exp(-length(q)*18.);c+=gold*g*2.5;return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}