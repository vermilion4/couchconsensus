#!/usr/bin/env python3
"""Synthesizes the TV's sound effects (TV-8) from scratch, so no third-party audio is used.

Writes apps/server/sounds/{whistle,coin}.m4a: AAC in an MP4 container (afconvert on macOS),
the only format the Vega Virtual Device plays, through MediaSource (spike S5).
Run: python3 scripts/build-sounds.py
"""
import math, random, struct, subprocess, tempfile, wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parent.parent / "apps/server/sounds"


def envelope(t, length, attack=0.015, release=0.06):
    return min(1.0, t / attack, max(0.0, (length - t) / release))


def whistle():
    """A referee's pea whistle: a short blast, then a long one. The pea makes a ~28 Hz trill."""
    out = []
    for start, length in ((0.0, 0.22), (0.32, 0.62)):
        while len(out) < int(start * RATE):
            out.append(0.0)
        phase = 0.0
        for i in range(int(length * RATE)):
            t = i / RATE
            trill = math.sin(2 * math.pi * 28 * t)
            freq = 2950 + 160 * trill  # the pea wobbles the pitch...
            phase += 2 * math.pi * freq / RATE
            amp = 0.55 + 0.45 * (0.5 + 0.5 * trill)  # ...and the loudness
            breath = random.uniform(-1, 1) * 0.08  # a little air noise
            tone = math.sin(phase) + 0.25 * math.sin(2 * phase)
            out.append(envelope(t, length) * amp * (tone * 0.8 + breath))
    return out


def coin():
    """A flipped coin: three quick clinks, then a bright ring that dies away (inharmonic partials)."""
    partials = ((2350, 1.0), (5170, 0.6), (7450, 0.35), (9800, 0.2))
    out = [0.0] * int(1.3 * RATE)
    for when, gain, decay in ((0.0, 0.35, 40), (0.11, 0.4, 40), (0.2, 0.45, 40), (0.3, 0.9, 5)):
        base = int(when * RATE)
        for i in range(int(1.0 * RATE)):
            if base + i >= len(out):
                break
            t = i / RATE
            s = sum(a * math.sin(2 * math.pi * f * t) for f, a in partials)
            out[base + i] += gain * math.exp(-decay * t) * min(1.0, t / 0.002) * s / 2.15
    return out


def write(name, samples):
    peak = max(abs(s) for s in samples) or 1.0
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / f"{name}.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes(b"".join(struct.pack("<h", int(s / peak * 0.85 * 32767)) for s in samples))
        dest = OUT / f"{name}.m4a"
        subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "128000", str(wav), str(dest)], check=True)
        print(f"wrote {dest.relative_to(OUT.parent.parent.parent)} ({dest.stat().st_size} bytes)")


if __name__ == "__main__":
    random.seed(7)  # same file every run
    OUT.mkdir(parents=True, exist_ok=True)
    write("whistle", whistle())
    write("coin", coin())
