// CPU runner for generated Metal passes. Loads one shared object per pass (built from the generated .metal by the
// motif-metal parity test), renders passes in order like the Swift runtime does (intermediates in half float, row 0 on
// top, pass n sees passes 0..n-1 as buf0..3) and writes the final frame as RGBA8.
#include <dlfcn.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <fstream>
#include <string>
#include <vector>

struct CpuTex { const float* data; int w, h; };
typedef void (*RunFn)(const float*, const float*, const CpuTex*, int, int, float*);

static float toHalf(float v) { return (float)(_Float16)v; }

int main(int argc, char** argv) {
  if (argc < 2) { fprintf(stderr, "usage: driver job.txt\n"); return 2; }
  std::ifstream f(argv[1]);
  int W, H; f >> W >> H;
  float* U = (float*)aligned_alloc(16, 144); for (int i = 0; i < 36; i++) f >> U[i];
  int np; f >> np; std::vector<float> P(np > 0 ? np : 1, 0.f); for (int i = 0; i < np; i++) f >> P[i];
  int npass; f >> npass;
  struct Job { std::string so, fn; float scale; };
  std::vector<Job> jobs(npass);
  for (auto& j : jobs) f >> j.so >> j.fn >> j.scale;
  int nm; f >> nm; std::vector<std::vector<float>> media(nm);
  for (int m = 0; m < nm; m++) { std::string path; f >> path; media[m].resize((size_t)W * H * 4); FILE* fp = fopen(path.c_str(), "rb"); if (!fp || fread(media[m].data(), 4, media[m].size(), fp) != media[m].size()) { fprintf(stderr, "media read failed\n"); return 3; } fclose(fp); }
  std::string outPath; f >> outPath;

  std::vector<std::vector<float>> bufs; std::vector<std::pair<int, int>> dims;
  std::vector<float> finalImg;
  for (int i = 0; i < npass; i++) {
    bool last = i == npass - 1;
    int pw = last ? W : std::max(1, (int)std::lround(W * jobs[i].scale)), ph = last ? H : std::max(1, (int)std::lround(H * jobs[i].scale));
    void* h = dlopen(jobs[i].so.c_str(), RTLD_NOW);
    if (!h) { fprintf(stderr, "dlopen %s: %s\n", jobs[i].so.c_str(), dlerror()); return 4; }
    RunFn run = (RunFn)dlsym(h, ("cpu_" + jobs[i].fn).c_str());
    if (!run) { fprintf(stderr, "missing cpu_%s\n", jobs[i].fn.c_str()); return 5; }
    CpuTex T[6] = {};
    for (int b = 0; b < 4 && b < i; b++) T[b] = {bufs[b].data(), dims[b].first, dims[b].second};
    for (int m = 0; m < nm && m < 2; m++) T[4 + m] = {media[m].data(), W, H};
    U[0] = (float)pw; U[1] = (float)ph; U[6] = last ? 1.f : 0.f;
    std::vector<float> out((size_t)pw * ph * 4);
    run(U, P.data(), T, pw, ph, out.data());
    if (last) finalImg = std::move(out);
    else { for (auto& v : out) v = toHalf(v); bufs.push_back(std::move(out)); dims.push_back({pw, ph}); }
  }
  std::vector<uint8_t> bytes((size_t)W * H * 4);
  for (size_t i = 0; i < bytes.size(); i++) { float v = finalImg[i]; v = v < 0 ? 0 : v > 1 ? 1 : v; bytes[i] = (uint8_t)std::lround(v * 255.0f); }
  FILE* fp = fopen(outPath.c_str(), "wb"); fwrite(bytes.data(), 1, bytes.size(), fp); fclose(fp);
  return 0;
}
