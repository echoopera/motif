// Output: opaque linear RGBA. Soft vignette plus a perceptually scaled triangular dither to stop banding in the dark falloff.
vec4 motif(vec2 uv,vec2 fc){vec2 q=fc/u_res;vec3 c=g_sceneAt(q).rgb;c*=1.-.22*smoothstep(.3,1.4,length(uv));
float n=kIgn(fc)+kIgn(fc+vec2(37.,17.))-1.;c+=n*pow(max(c,vec3(.002)),vec3(.545))/255.;return vec4(max(c,vec3(0.)),1.);}
