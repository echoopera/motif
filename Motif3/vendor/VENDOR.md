# Vendored libraries

Inlined into `motif5.html` by `src-v5/build.py` (markers `<!--vendor:name-->` in `src-v5/head.html`). Exports and ZIP therefore work offline and without a CDN. Versions are pinned; to upgrade, `npm pack <pkg>@<ver>`, copy the file below, update `build.py` (`VENDOR`), this table, and run the tests.

| Library | Version | File (from the npm tarball) | Bytes | sha256 | Licence |
|---|---|---|---|---|---|
| fflate | 0.8.3 | `fflate-0.8.3.umd.js` (`umd/index.js`) | 33,044 | `462ef8041fc970e3615a20a9dd2b2e3047a073b2da729ef4f02b634bba8b7b83` | MIT, `LICENSE.fflate` |
| mp4-muxer | 5.2.2 | `mp4-muxer-5.2.2.js` (`build/mp4-muxer.js`) | 73,921 | `cc4d30bd20b9ffe0b15f59cf0de3e1930626ccd46a5146e36e4d619d7fecf63d` | MIT, `LICENSE.mp4-muxer` |
| webm-muxer | 5.1.4 | `webm-muxer-5.1.4.js` (`build/webm-muxer.js`) | 69,013 | `8f072405cf7c9e23ae600948cb0ca2ff78c0277b3d78951cd4697b36d88ebd7b` | MIT, `LICENSE.webm-muxer` |

Total 175,978 bytes added to the built HTML.

Not vendored: the optional FDK-AAC WebAssembly fallback (`@audio/encode-aac`, a dynamic `import()` in `13-exporter.js`) used only for MP4 audio in browsers without a WebCodecs AAC encoder. Without network it fails soft and the export falls back to Opus. Google Fonts remain external by design.
