// field-class: exact circle/segment distances and implicit interference curves; aesthetic glow renderer.
// Golden ratio scales space only. All time rotations use whole circuits; alternate layers counter-rotate so they beat against each other.
vec3 geometry(vec2 q,float ph,float layer){float phi=1.61803398875;float line=(180.+90.*p_complexity)/p_membrane;line=min(line,.9/max(length(dFdx(q)),.00001));
float mark=0.;for(int j=0;j<13;j++){float fj=float(j);float a=mod(fj-1.,6.)*TAU/6.;float rr=j==0?0.:(j<7?.22:.44);vec2 c=rr*vec2(cos(a),sin(a));mark+=exp(-abs(length(q-c)-.105)*line)*.28;if(j>0)mark+=exp(-kSegment(q,vec2(0.),c)*line)*.10;}
vec3 pigment=kMix(u_a0,u_a1,.18+layer*.19);return (pigment*mark*.82+u_ink*pow(max(mark,0.),3.)*.85)*1.7;}
vec4 motif(vec2 uv,vec2 fc){float ph=kPhase();float phi=1.61803398875;float fr=dot(uv,uv);vec3 col=u_bg+u_a2*.04*exp(-fr*1.2);
for(int k=0;k<4;k++){if(k>=p_layers)break;float fk=float(k);float dir=1.-2.*mod(fk,2.);
vec2 q=kRot(dir*ph*float(k+1)+fk*.4)*uv*p_scale*p_density*pow(phi,fk*.5);
vec3 g=geometry(q,ph,fk);col+=g*exp(-fk*p_depth*.065)*p_radiance;
}
// One focal point: a small emissive core at the centre where the lines converge.
col+=kMix(u_a1,u_ink,.55)*(exp(-fr*160.)*.30+exp(-fr*14.)*.012)*p_radiance;
return vec4(col,1.);}
