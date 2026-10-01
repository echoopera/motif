// FaceType 1.3: glyph alpha comes from the host's text atlas (motif-kit@3 text input "type", three lines).
// Motif rasterizes each line centred and untransformed in its own band; this function applies the line's
// XY, scale and angle exactly once. Time is exclusively u_p.
// Geometry (as in 1.2, where a stretched plate band covered the frame): at scale 1 a line's band spans the frame
// width, centred at 0.5 + pos * 0.5 in frame-normalized coordinates. Rotation and scale now act in square pixels,
// so angled lines are no longer sheared by the frame aspect.
float ftLine(vec2 q, int id, vec2 pos, float sc, float angle, float opacity) {
  if (u_typeOn < 0.5) return 0.0;
  float asp = u_res.x / u_res.y;
  vec2 p = (q - 0.5 - pos * 0.5) * vec2(asp, 1.0);   // frame-height units, isotropic
  p = rot(radians(-angle)) * p / max(sc, 0.01);
  float alpha = textLine_type(id, p / asp).a;        // band width = frame width
  return pow(alpha, 1.0 / max(p_contrast, 0.5)) * opacity;
}
float ftStroke(vec2 q, int id, vec2 pos, float sc, float angle, float opacity, float width) {
  float c = ftLine(q,id,pos,sc,angle,opacity);
  float e = max(width,0.0005);
  float b = max(max(ftLine(q+vec2(e,0.0),id,pos,sc,angle,opacity),ftLine(q-vec2(e,0.0),id,pos,sc,angle,opacity)),max(ftLine(q+vec2(0.0,e),id,pos,sc,angle,opacity),ftLine(q-vec2(0.0,e),id,pos,sc,angle,opacity)));
  return max(b-c,0.0);
}
float ftRule(float x, float at, float w) { return 1.0-smoothstep(w,w+1.5/min(u_res.x,u_res.y),abs(x-at)); }
vec3 ftInk(int id) { return id == 0 ? c_line1Ink() : id == 1 ? c_line2Ink() : c_line3Ink(); }
vec2 ftPos(int id) { return id == 0 ? v_line1Pos() : id == 1 ? v_line2Pos() : v_line3Pos(); }
float ftScale(int id) { return id == 0 ? p_line1Scale : id == 1 ? p_line2Scale : p_line3Scale; }
float ftAngle(int id) { return id == 0 ? p_line1Angle : id == 1 ? p_line2Angle : p_line3Angle; }
float ftOpacity(int id) { return id == 0 ? p_line1Opacity : id == 1 ? p_line2Opacity : p_line3Opacity; }
vec4 faceScene(vec2 uv, vec2 fc, int mode) {
  vec2 q = fc / u_res;
  vec3 base = c_field();
  vec3 accentColor = c_accentInk();
  float grid = 0.0;
  if (p_grid) {
    vec2 cell = abs(fract(q * vec2(12.0, 8.0))-0.5);
    grid = max(1.0-smoothstep(0.492,0.5,cell.x),1.0-smoothstep(0.492,0.5,cell.y))*0.055;
  }
  vec3 rgb = base + accentColor * grid;
  float coverage = (p_backdrop == BACKDROP_SOLID ? 1.0 : grid*0.16);
  float t = TAU * float(p_cycles) * u_p;
  float amount = p_motion * 0.085;
  // Structure belongs behind type, preserving glyph legibility.
  float frame = 0.0;
  if (mode == 0 || mode == 1 || mode == 9) {
    frame = max(ftRule(q.x,0.045,p_edge),ftRule(q.x,0.955,p_edge));
    frame = max(frame,max(ftRule(q.y,0.055,p_edge),ftRule(q.y,0.945,p_edge)));
  }
  if (mode == 0) frame += ftRule(q.x,0.382,p_edge*0.5)*0.23;
  if (mode == 1) frame += ftRule(q.y,0.69,p_edge*0.5)*0.35;
  if (mode == 4) frame += (1.0-smoothstep(0.0,p_edge*3.0,abs(q.y-(0.5+0.38*sin(t)))))*0.5;
  if (mode == 9) frame += step(0.92,q.x)*0.5 + step(q.y,0.07)*0.3;
  rgb += accentColor * min(frame,1.0) * (0.14+0.4*p_density);
  coverage = max(coverage,min(frame,1.0)*0.25);
  if (u_typeOn < 0.5) {
    // Host without a text atlas yet: a visible composition of rules, never a fake glyph.
    float bars = 0.0;
    for (int i=0;i<3;i++) {
      vec2 p=ftPos(i)*0.5+vec2(0.5,0.5);
      float w=i==0?0.32:i==1?0.23:0.16;
      float d=sdBox(q-p,vec2(w,p_edge*(i==0?4.0:2.0)));
      bars=max(bars,1.0-smoothstep(0.0,0.003,d));
    }
    rgb += bars*accentColor*0.55;
    coverage=max(coverage,bars*0.55);
  }
  for (int i=0;i<3;i++) {
    vec2 pos=ftPos(i);
    vec2 sampleQ=q;
    float ph=t+float(i)*1.7;
    if (mode==2) {
      float band=floor(q.y*(8.0+32.0*p_density));
      sampleQ.x += amount * sin(t + band*1.67) * (0.4+0.6*lsin(float(p_cycles),0.0)*lsin(float(p_cycles),0.0));
    } else if(mode==3) sampleQ.y += amount*0.65*sin(q.x*(8.0+24.0*p_density)+t+float(i));
    else if(mode==4) sampleQ.x += amount*0.55*sin(t+q.y*28.0);
    else if(mode==5) sampleQ -= amount*vec2(cos(ph),sin(ph))*0.48;
    else if(mode==6) sampleQ.y += amount*sin(t+floor(q.x*(8.0+18.0*p_density))*0.9)*0.55;
    else if(mode==9) sampleQ.x += amount*0.9*(1.0-cos(t))*0.5;
    float a=ftLine(sampleQ,i,pos,ftScale(i),ftAngle(i),ftOpacity(i));
    vec3 ink=ftInk(i);
    if(mode==4) a *= 0.68+0.32*sin(q.y*440.0)*sin(q.y*440.0);
    if(mode==7) {
      for(int e=1;e<=3;e++) {
        vec2 shift=vec2(0.012*float(e)*sin(t+float(i)),0.005*float(e));
        float trail=ftLine(sampleQ-shift,i,pos,ftScale(i),ftAngle(i),ftOpacity(i));
        float strength=0.16*p_density/float(e);
        rgb=mix(rgb,accentColor,trail*strength);
        coverage=max(coverage,trail*strength);
      }
    }
    if(mode==8) {
      float edge=ftStroke(sampleQ,i,pos,ftScale(i),ftAngle(i),ftOpacity(i),p_edge*(1.0+p_density));
      rgb=mix(rgb,accentColor,edge*0.8);
      coverage=max(coverage,edge*0.8);
    }
    rgb=mix(rgb,ink,sat(a));
    coverage=max(coverage,sat(a));
  }
  return vec4(rgb*coverage,coverage);
}
