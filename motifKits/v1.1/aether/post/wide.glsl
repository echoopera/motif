// Wide bloom tier: a 5x5 gaussian at twice the tap spacing gives the halo a soft, film-like tail.
vec4 motif(vec2 uv,vec2 fc){vec2 q=fc/u_res;vec2 px=p_radius*2.4/vec2(textureSize(g_bright,0));vec3 c=vec3(0.);float t=0.;for(int y=-2;y<=2;y++){for(int x=-2;x<=2;x++){float w=exp(-float(x*x+y*y)*.3);c+=g_brightAt(q+vec2(float(x),float(y))*px).rgb*w;t+=w;}}return vec4(c/t,1.);}
