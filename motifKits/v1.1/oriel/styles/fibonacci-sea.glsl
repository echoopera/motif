// field-class: exact circle/segment distances and implicit interference curves; aesthetic glow renderer.
// Golden ratio scales space only. All time rotations use whole circuits; alternate layers counter-rotate so they beat against each other.
vec3 geometry(vec2 q,float ph,float layer){float phi=1.61803398875;float line=(180.+90.*p_complexity)/p_membrane;
float mark=0.;for(int j=0;j<7;j++){float r=.028*pow(phi,float(j));float d=abs(length(q)-r);mark+=exp(-d*line)*.35;}float a=atan(q.y,q.x);mark+=exp(-abs(sin(log(max(length(q),.005))/log(phi)*PI*.5-a+ph))*75.)*.26;
vec3 pigment=kMix(u_a0,u_a1,.18+layer*.19);return (pigment*mark*.82+u_ink*pow(max(mark,0.),3.)*.85)*1.2;}
vec4 motif(vec2 uv,vec2 fc){float ph=kPhase();float phi=1.61803398875;float fr=dot(uv,uv);vec3 col=u_bg+u_a2*.04*exp(-fr*1.2);
for(int k=0;k<4;k++){if(k>=p_layers)break;float fk=float(k);float dir=1.-2.*mod(fk,2.);
vec2 q=kRot(dir*ph*float(k+1)+fk*.4)*uv*p_scale*p_density*pow(phi,fk*.5);
vec3 g=geometry(q,ph,fk);col+=g*exp(-fk*p_depth*.065)*p_radiance;
}
// One focal point: a small emissive core at the centre where the lines converge.
col+=kMix(u_a1,u_ink,.55)*(exp(-fr*160.)*.30+exp(-fr*14.)*.012)*p_radiance;
return vec4(col,1.);}
