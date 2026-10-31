# Role.via Auto Apply launch video

A 33-second launch video with Three.js motion graphics, a Kokoro voiceover and a synthesised soundtrack.

| File | Format | Use |
|------|--------|-----|
| `out/auto-apply-portrait.mp4` | 1080×1920, 9:16, 30 fps | Instagram Reels, YouTube Shorts, WhatsApp status |
| `out/auto-apply-landscape.mp4` | 1920×1080, 16:9, 30 fps | YouTube, LinkedIn, website |

Captions are burned in, so the video works with the sound off.

## Check before posting

The Auto Apply code was not available when this was made, so these lines about it come from the founder's description and have **not** been checked against the feature:

| Time | Line | Check |
|------|------|-------|
| 5.5s | "So we built Auto Apply." | Feature name is exactly "Auto Apply" |
| 7.9s | "Role.via now sends your job applications for you." | It submits applications itself (it doesn't only prefill or suggest them) |
| 7.9s | On-screen: "Applications, sent for you" and "APPLIED ✓" stamps | Same as above |
| 25.9s | "Auto Apply. Now on Role.via." / "NEW: AUTO APPLY" | It is live on rolevia.xyz when the video goes out |
| 25.9s | "Start free at rolevia.xyz" | Signing up is free (true today: 1 free interview and 1 free GD). If Auto Apply is paid only, consider changing the line |

Everything else is checked against the Role.via code:
- Company profiles label items verified, reported or AI-generated (`src/`, help and how-it-works pages).
- The AI interviewer speaks, listens to spoken answers and follows up on thin answers.
- The interview questions on screen are taken from the question templates in `src/iv.html`.
- The video has no user numbers, testimonials, college names or hiring promises, following `.agents/product-marketing.md`.

## Script

| # | Time | Voiceover |
|---|------|-----------|
| 1 | 0.6s | Placement season. The same application form. Again, and again, and again. |
| 2 | 5.5s | So we built Auto Apply. |
| 3 | 7.9s | Role.via now sends your job applications for you. |
| 4 | 11.7s | You spend that time where it counts. |
| 5 | 13.8s | Research the company, with every fact labelled verified, reported or AI-generated. |
| 6 | 19.6s | Then practise the interview out loud, with an AI interviewer that follows up on thin answers. |
| 7 | 25.9s | Auto Apply. Now on Role.via. Start free at rolevia.xyz |

Edit the lines in `script.json`: `say` is what the voice reads (spelled for pronunciation), `cap` is the caption.

## How it's made

- **Voice:** [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) TTS running locally, voice `af_heart`. ElevenLabs was the first choice, but no ElevenLabs key was available and its API was blocked by the network settings of the environment this was made in.
- **Music and sound effects:** synthesised in `build_audio.py`. The track has a pad that brightens on the reveal, a 104 bpm pulse, ticks under the hook, whooshes on scene changes and impacts on the reveal and the end card. The music ducks under the voice. No licensed audio is used.
- **Visuals:** `scene.html` is a Three.js scene with bloom, particle text in the brand font (Sora), 3D form cards and a portal. The company panel and interviewer ring are drawn in WebGL. Captions and chat bubbles are HTML on top. Every frame is a function of time (`renderAt(t)`), so renders are exact and repeatable.
- **Render:** `render.js` steps through each frame in headless Chromium and pipes the frames to ffmpeg with the soundtrack.

## Re-render

Needs Node 18+, Python 3.10+, ffmpeg and Playwright's Chromium.

```bash
cd video/auto-apply-launch
npm install

# Voice + soundtrack (needs kokoro-onnx and soundfile installed in Python, plus
# kokoro-v1.0.int8.onnx saved as kokoro.onnx and voices-v1.0.bin saved as voices.bin
# in one folder, from the kokoro-onnx GitHub releases)
python build_audio.py /path/to/kokoro-folder af_heart

# Check stills, then render
node render.js portrait --stills 3,6.4,9.6,18,24,30
node render.js portrait
node render.js landscape
```

To use ElevenLabs instead, replace the `k.create(...)` call in `build_audio.py` with an ElevenLabs text-to-speech request per line. The rest of the pipeline reads timings from whatever audio it produces.
