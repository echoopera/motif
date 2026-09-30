# Runtime diagnostics: report the API used by a successful kit draw without adding WebGPU readback barriers.
src = rep(src, "      } else style.render(ctx, S);\n    } catch (e) { if (e && e.isSuspend)", "      } else { const used = style.render(ctx, S); if (used === 'webgl' || used === 'software-gl') engine = used; }\n    } catch (e) { if (e && e.isSuspend)")
src = rep(src, "    const eng = info && info.engines && info.engines.includes('gpu') ? ' · GPU' : '';\n    $('perf').textContent = `${stage.frameMs().toFixed(1)} ms${info && info.samples > 1 ? ` · ${info.samples}× blur` : ''}${eng}`;", """    const engines = info && info.engines || [];
    const eng = engines.includes('gpu') ? ' · WebGPU' : engines.includes('webgl') ? ' · WebGL' : engines.includes('software-gl') ? ' · Software GL' : '';
    const cadence = K.gpuStatus().cadence;
    const rate = stage.playing && cadence.fps ? `${Math.round(cadence.fps)} fps · ` : '';
    $('perf').textContent = `${rate}${stage.frameMs().toFixed(1)} ms${info && info.samples > 1 ? ` · ${info.samples}× blur` : ''}${eng}`;
    $('perf').title = `Main-thread render submission time. ${stage.playing && cadence.fps ? `Recent frame interval: ${cadence.meanMs.toFixed(1)} ms average, ${cadence.p95Ms.toFixed(1)} ms at the 95th percentile. ` : ''}The Shaders indicator shows internal preview resolution; exports use full resolution.`;""")
src = rep(src, "    const now = performance.now(); if (now - lastUi < 60 && stage.playing) return; lastUi = now;", "    const now = performance.now(); if (now - lastUi < 60 && stage.playing) return; lastUi = now;\n    media.syncPlayback(project);")
src = rep(src, "  K.setMediaResolver(media.resolve);", "  K.setMediaResolver(media.resolve);\n  document.addEventListener('visibilitychange', () => { if (document.hidden) media.pauseAll(); });")
