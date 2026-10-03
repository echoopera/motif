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
vec3 ro=vec3(0.,0.,3.4),rd=normalize(vec3(q*1.25,-2.2));float dist=0.;vec3 pos;bool hit=false;for(int i=0;i<96;i++){pos=ro+rd*dist;pos.xz=vec2(pos.x,pos.z)*rot(.2*sin(t)+.3);float gy=dot(sin(pos*5.),cos(pos.yzx*5.));float shell=(abs(gy)-.19)/12.25;float bound=length(pos)-1.22;float d=max(shell,bound);if(d<.0015){hit=true;break;}dist+=max(d,.002);if(dist>6.)break;}c=vec3(.007,.035,.14);if(hit){vec2 e=vec2(.002,0.);vec3 n=normalize(vec3(dot(cos(pos*5.)*vec3(5.,0.,0.),cos(pos.yzx*5.))+dot(sin(pos*5.),-sin(pos.yzx*5.)*vec3(0.,0.,5.)),dot(cos(pos*5.)*vec3(0.,5.,0.),cos(pos.yzx*5.))+dot(sin(pos*5.),-sin(pos.yzx*5.)*vec3(5.,0.,0.)),dot(cos(pos*5.)*vec3(0.,0.,5.),cos(pos.yzx*5.))+dot(sin(pos*5.),-sin(pos.yzx*5.)*vec3(0.,5.,0.))));n*=sign(dot(sin(pos*5.),cos(pos.yzx*5.)));float light=max(0.,dot(n,normalize(vec3(-1.,2.,3.))));float fres=pow(1.-abs(dot(n,-rd)),3.);float chrome=step(.3,sin(pos.y*3.+pos.x*2.));vec3 base=mix(vec3(.82,.87,.92),vec3(.055,.11,.22),chrome);c=base*(.13+.9*light)+vec3(.4,.62,1.)*fres*.65+gold*pow(max(0.,dot(reflect(rd,n),normalize(vec3(-1.,2.,3.)))),24.); }return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}