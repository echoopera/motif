// Spatial bloom: the radius follows the actual source target, not full-output pixels.
vec4 motif(vec2 uv,vec2 fc){vec2 q=fc/u_res;vec2 px=p_radius/vec2(textureSize(g_bright,0));vec3 c=vec3(0.);float total=0.;for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){float w=(x==0?2.:1.)*(y==0?2.:1.);c+=g_brightAt(q+vec2(float(x),float(y))*px).rgb*w;total+=w;}}return vec4(c/total,1.);}
