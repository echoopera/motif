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
c=vec3(.005,.014,.045);for(int j=0;j<42;j++){float z=float(j)/41.;for(int i=0;i<58;i++){float x=(float(i)/57.-.5)*2.1;float zz=z*2.7-1.3;float h=.18*sin(x*6.+t)*cos(zz*4.-t)+.12*sin(x*10.+zz*5.);float depth=2.7+zz;vec2 pt=vec2(x,h*.7-zz*.38)/depth*1.65;float d=length(q-pt);float s=.0025+.006/depth;float core=exp(-d*d/(s*s));float glow=exp(-d*65.);vec3 col=mix(ice,gold,smoothstep(.08,.2,h));c+=col*(core*1.9+glow*.045);if(i<57){float nx=x+2.1/57.;float nh=.18*sin(nx*6.+t)*cos(zz*4.-t)+.12*sin(nx*10.+zz*5.);vec2 np=vec2(nx,nh*.7-zz*.38)/depth*1.65;c+=ice*stroke(line(q,pt,np),.00055)*.23;}}}return c;}void main(){vec2 q=(gl_FragCoord.xy-.5*u_res)/u_res.y;vec3 c=shade(q,TAU*u_p);c=1.-exp(-max(c,vec3(0.)));c=pow(c,vec3(1./2.2));frag=vec4(c,1.);}