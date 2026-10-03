// Shared helpers for every style in this kit. Compiled after the Motif prelude, before each pass.
float ring(float d, float w) { return exp(-d * d / (w * w)); }
