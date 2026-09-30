    render(ctx, S) {
      const c = rt.compile(st.id, def);
      if (!c.ok) {
        if (c.pending) { drawProblem(ctx, S, 'Compiling shader…', true); watchCompiles(); return; }
        if (c.lost) { drawProblem(ctx, S, 'GPU reset · recovering', true); return; }
        errorsByStyle.set(st.id, c.error); drawProblem(ctx, S, rt.ok ? `${st.name}: shader error` : 'WebGL2 unavailable'); return;
      }
      const tempo = S.tempo || 1, Leff = (S.L || 6) / tempo;
      const u = { p: S.p, L: Leff, seed: S.seed, safe, pal: S.pal, params: S.P, spec: params };
      const opt = drawPlan(st, S.w, S.h);
      // Photosensitive low-pass: when the effective loop is shorter than LOWPASS_BELOW seconds, even ordinary
      // motion repeats faster than 3 Hz, so blend LOWPASS_TAPS sub-frames with triangle weights across
      // LOWPASS_SECONDS (first zero at 3 Hz, strong roll-off above). Stateless, so exports and scrubbing agree.
      if (safe && Leff < LOWPASS_BELOW) {
        const job = JOB.on ? JOB : null;
        let acc, ent = null, i0 = 0;
        if (job) {
          const sig = `${st.id}|${S.p}|${S.w}x${S.h}|${S.seed}|${S.pal.bg}|${S.pal.ink}|${JSON.stringify(S.P)}`;
          ent = job.kits.get(sig);
          if (!ent) { ent = { i: 0, cv: job.canvas(Math.ceil(S.w), Math.ceil(S.h)) }; job.kits.set(sig, ent); }
          acc = ent.cv; i0 = ent.i;
        } else acc = accCanvas(S.w, S.h);
        const ax = acc.getContext('2d');
        ax.setTransform(1, 0, 0, 1, 0, 0);
        if (i0 === 0) { ax.globalCompositeOperation = 'source-over'; ax.globalAlpha = 1; ax.clearRect(0, 0, acc.width, acc.height); }
        ax.globalCompositeOperation = 'lighter';
        const w = LOWPASS_SECONDS / Leff, full = w >= 1, n = full ? FULL_TAPS : LOWPASS_TAPS;
        const wt = i => (full ? 1 : 1 - Math.abs((i + 0.5) / n * 2 - 1)), wsum = Array.from({ length: n }, (_, i) => wt(i)).reduce((a, b) => a + b, 0);
        // Sub-frames share the frame's GPU budget.
        const sub = { scale: preview && adaptivePreview ? Math.max(0.2, opt.scale / Math.sqrt(n / 2)) : opt.scale, bands: opt.bands };
        for (let i = i0; i < n; i++) {
          ax.globalAlpha = wt(i) / wsum;
          const pp = full ? S.p + i / n : S.p + ((i + 0.5) / n - 0.5) * w;
          if (!rt.draw(st.id, S.w, S.h, { ...u, p: pp - Math.floor(pp) }, sub)) { drawProblem(ctx, S, 'GPU reset · recovering', true); return; }
          rt.blit(ax, S.w, S.h);
          if (ent) { ent.i = i + 1; if (i + 1 < n && job.expired()) throw SUSPEND; }
        }
        ctx.drawImage(acc, 0, 0, S.w, S.h, 0, 0, S.w, S.h);
        noteScale(sub.scale);
        return rt.software ? 'software-gl' : 'webgl';
      }
      const canvas = rt.draw(st.id, S.w, S.h, u, opt);
      if (!canvas) { drawProblem(ctx, S, 'GPU reset · recovering', true); return; }
      rt.blit(ctx, S.w, S.h);
      noteScale(opt.scale);
      return rt.software ? 'software-gl' : 'webgl';
    },
