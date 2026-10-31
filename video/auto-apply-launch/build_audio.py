# Builds the voiceover timeline and the full soundtrack for the launch video.
# Usage: python build_audio.py <kokoro_dir> [voice]
# Writes vo/*.wav, timeline.json and out/audio.wav.
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
KDIR = sys.argv[1]
VOICE = sys.argv[2] if len(sys.argv) > 2 else "af_heart"
SR = 24000

# Silence before each line (seconds). The reveal gets a longer beat for the impact.
GAP_BEFORE = {"hook": 0.6, "reveal": 0.55, "apply": 0.9, "pivot": 0.45, "research": 0.4, "practise": 0.45, "cta": 0.6}
TAIL = 2.2  # hold on the end card after the last line

lines = json.load(open(os.path.join(HERE, "script.json")))
k = Kokoro(os.path.join(KDIR, "kokoro.onnx"), os.path.join(KDIR, "voices.bin"))
os.makedirs(os.path.join(HERE, "vo"), exist_ok=True)
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)

t, segs, clips = 0.0, [], []
for l in lines:
    s, sr = k.create(l["say"], voice=VOICE, speed=1.05, lang="en-us")
    assert sr == SR
    sf.write(os.path.join(HERE, "vo", l["id"] + ".wav"), s, sr)
    t += GAP_BEFORE[l["id"]]
    dur = len(s) / sr
    segs.append({"id": l["id"], "cap": l["cap"], "start": round(t, 3), "end": round(t + dur, 3)})
    clips.append((t, s))
    t += dur
total = round(t + TAIL, 3)
json.dump({"duration": total, "segments": segs}, open(os.path.join(HERE, "timeline.json"), "w"), indent=1)

n = int(total * SR) + 1
time = np.arange(n) / SR
vo = np.zeros(n)
for start, s in clips:
    i = int(start * SR)
    vo[i:i + len(s)] += s
seg = {x["id"]: x for x in segs}

# ---- sound design (all synthesised) ----
rng = np.random.default_rng(7)
def env(t0, attack, decay):
    e = np.zeros(n)
    m = time >= t0
    x = time[m] - t0
    e[m] = np.minimum(x / attack, 1.0) * np.exp(-np.maximum(x - attack, 0) / decay)
    return e
def lowpass(x, a):
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc); y[i] = acc
    return y

# Pad: minor-ish chord that brightens to major at the reveal.
reveal = seg["reveal"]["start"]
bright = np.clip((time - reveal) / 1.5, 0, 1)
pad = np.zeros(n)
for f, w in [(55, .5), (110, .35), (164.8, .22), (220, .18)]:
    pad += w * np.sin(2 * np.pi * f * time + 0.3 * np.sin(2 * np.pi * 0.11 * time))
third = (1 - bright) * np.sin(2 * np.pi * 130.8 * time) + bright * np.sin(2 * np.pi * 138.6 * time)
pad += 0.16 * third
pad *= 0.55 + 0.45 * np.sin(2 * np.pi * 0.25 * time) ** 2
pad *= np.clip(time / 2.0, 0, 1) * np.clip((total - time) / 1.5, 0, 1)

# Pulse: soft kick on a 104 bpm grid once the reveal lands, ducked out on the end card.
beat = 60 / 104
kick = np.zeros(n)
b = reveal
while b < seg["cta"]["start"] + 1.2:
    m = (time >= b) & (time < b + 0.35)
    x = time[m] - b
    kick[m] += np.sin(2 * np.pi * (48 + 90 * np.exp(-x * 30)) * x) * np.exp(-x * 9)
    b += beat
hats = lowpass(rng.standard_normal(n), 0.9) - lowpass(rng.standard_normal(n), 0.05)
hat_env = np.zeros(n)
b = reveal + beat / 2
while b < seg["cta"]["start"] + 1.2:
    hat_env += env(b, 0.002, 0.03); b += beat
hats *= hat_env * 0.08

# Ticks under the hook: a form being filled in, again and again.
ticks = np.zeros(n)
h0, h1 = seg["hook"]["start"], reveal - 0.2
for j, b in enumerate(np.arange(h0, h1, 0.23)):
    ticks += env(b, 0.001, 0.012) * np.sin(2 * np.pi * (1800 + 300 * (j % 3)) * time)
ticks *= 0.12

# Whooshes before scene changes; impacts on the reveal and the end card.
noise = rng.standard_normal(n)
whoosh = np.zeros(n)
for key in ["reveal", "apply", "research", "practise", "cta"]:
    c = seg[key]["start"] - 0.15
    w = np.exp(-((time - c) / 0.28) ** 2)
    whoosh += w
whoosh = lowpass(noise * whoosh, 0.08) * 1.2
impact = np.zeros(n)
for c, g in [(reveal - 0.05, 1.0), (seg["cta"]["start"] - 0.05, 0.8)]:
    m = time >= c; x = time[m] - c
    impact[m] += g * (np.sin(2 * np.pi * (35 + 60 * np.exp(-x * 6)) * x) * np.exp(-x * 2.2) + 0.25 * noise[m] * np.exp(-x * 14))

music = 0.20 * pad + 0.42 * kick + hats + ticks + 0.35 * whoosh + 0.55 * impact
# Duck the music under the voice.
vo_env = lowpass(np.abs(vo), 0.002)
duck = 1 - 0.55 * np.clip(vo_env / (vo_env.max() * 0.25), 0, 1)
mix = 1.0 * vo + music * duck
mix /= np.max(np.abs(mix)) / 0.89
sf.write(os.path.join(HERE, "out", "audio.wav"), mix.astype(np.float32), SR)
print("duration", total, "s;", ", ".join(f"{x['id']} {x['start']}-{x['end']}" for x in segs))
