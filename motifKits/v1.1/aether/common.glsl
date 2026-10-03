// Shared original colour, geometry and numeric helpers. All colour inputs are linear.
mat2 kRot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float kPhase(){return TAU*fract(u_p)*float(p_cycles);}
float kBell(float x,float w){return exp(-x*x/max(w*w,0.00001));}
vec3 kLab(vec3 c){vec3 q=mat3(.4122214708,.2119034982,.0883024619,.5363325363,.6806995451,.2817188376,.0514459929,.1073969566,.6299787005)*max(c,vec3(0.));q=pow(max(q,vec3(0.)),vec3(1./3.));return mat3(.2104542553,1.9779984951,.0259040371,.7936177850,-2.4285922050,.7827717662,-.0040720468,.4505937099,-.8086757660)*q;}
vec3 kRgb(vec3 c){vec3 q=mat3(1.,1.,1.,.3963377774,-.1055613458,-.0894841775,.2158037573,-.0638541728,-1.2914855480)*c;q=q*q*q;return max(vec3(0.),mat3(4.0767416621,-1.2684380046,-.0041960863,-3.3077115913,2.6097574011,-.7034186147,.2309699292,-.3413193965,1.7076147010)*q);}
vec3 kMix(vec3 a,vec3 b,float f){return kRgb(mix(kLab(a),kLab(b),clamp(f,0.,1.)));}
// Neutral highlight shoulder based on the Khronos PBR Neutral mathematical curve.
// Reference: github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/pbrNeutral.glsl
// Chosen over AgX here to retain the collection's muted palette roles.
vec3 kTone(vec3 v){v=max(v,vec3(0.));float low=min(v.r,min(v.g,v.b));v-=low<.08?low-6.25*low*low:.04;float peak=max(v.r,max(v.g,v.b));if(peak<=.76)return max(v,vec3(0.));float shoulder=1.-.0576/max(peak-.52,.0001);vec3 hue=v*(shoulder/max(peak,.0001));float neutral=1.-1./(1.+.15*(peak-shoulder));return clamp(mix(hue,vec3(shoulder),neutral),0.,1.);}
float kSegment(vec2 p,vec2 a,vec2 b){vec2 q=p-a,d=b-a;return length(q-d*clamp(dot(q,d)/max(dot(d,d),.00001),0.,1.));}
float kIgn(vec2 fc){return fract(52.9829189*fract(dot(fc,vec2(.06711056,.00583715))));}
float vaporNoise(vec3 q,float ph){float n=sin(q.x*.91+sin(q.z*.43+ph))*cos(q.y*1.3-q.z*.38-ph);n+=.5*sin(q.x*1.9+q.y*.8+ph)*cos(q.z*1.2-q.y*1.6-ph);n+=.22*p_complexity*sin(q.x*4.1-q.z*2.3+2.*ph)*cos(q.y*3.5+q.z*1.7-ph);return n;}
