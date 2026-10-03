// Output is opaque premultiplied linear RGBA. Motif performs the display conversion.
// Tone-mapped once here, with a vignette and a perceptually scaled triangular dither to stop 8-bit banding in dark gradients.
vec4 motif(vec2 uv,vec2 fc){vec2 q=fc/u_res;vec3 c=g_sceneAt(q).rgb+(g_glowAt(q).rgb+g_wideAt(q).rgb*.35)*p_glow;
float vignette=1.-p_vignette*smoothstep(.25,1.35,length(uv));vec3 mapped=kTone(c*p_exposure)*vignette;
float contrast=(u_safe>.5 && u_L<2.)?flashAmt(.2):1.;mapped=mix(u_bg*.5+u_ink*.12,mapped,contrast);
float n=kIgn(fc)+kIgn(fc+vec2(37.,17.))-1.;mapped+=n*1.0*pow(max(mapped,vec3(.002)),vec3(.545))/255.;
return vec4(max(mapped,vec3(0.)),1.);}
