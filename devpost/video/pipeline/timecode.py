"""Decode the tour's on-screen timecode from a Lens Studio preview recording, and resample it to real time.

usage: timecode.py decode <take.mp4> <times.json>
       timecode.py resample <take.mp4> <times.json> <t_base> <t_end> <out.mp4>
"""
import json, os, subprocess, sys
import numpy as np
S = os.path.dirname(os.path.abspath(__file__))
import imageio_ffmpeg
FF = os.environ.get("FFMPEG") or imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1392, 1910
BAND = (140, 240)       # rows that hold the discs (full-res)
CROP = (1236, 1694, 78, 216)  # w, h, x, y: drops the timecode band, keeps the aspect
NBITS = 16

def frames(path, vf, w, h, ch):
    p = subprocess.Popen([FF, "-v", "error", "-i", path, "-an", "-vf", vf, "-f", "rawvideo", "-pix_fmt",
                          "gray" if ch == 1 else "rgb24", "-"], stdout=subprocess.PIPE)
    n = w * h * ch
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(h, w) if ch == 1 else np.frombuffer(b, np.uint8).reshape(h, w, ch)

def decode(take, out):
    y0, y1 = BAND
    band = list(frames(take, f"crop={W}:{y1 - y0}:0:{y0},format=gray", W, y1 - y0, 1))
    a = np.stack(band).astype(np.float32)                      # frames x rows x cols
    bright = (a > 215)
    # disc row/columns: columns that are bright in many frames (discs never move: they're parented to the camera)
    colfreq = bright.any(axis=1).mean(axis=0)
    rowfreq = bright.any(axis=2).mean(axis=0)
    cols = np.where(colfreq > 0.3)[0]
    segs = np.split(cols, np.where(np.diff(cols) > 3)[0] + 1)
    guards = (segs[0].mean(), segs[-1].mean())
    row = int(np.argmax(rowfreq))
    centers = np.linspace(guards[0], guards[1], NBITS + 2)
    print("guards", [round(g, 1) for g in guards], "row", row + y0, "segments", len(segs))
    times = []
    for f in a:
        v = 0
        ok = f[row, int(round(centers[0]))] > 200 and f[row, int(round(centers[-1]))] > 200
        for b in range(NBITS):
            x = int(round(centers[1 + b]))
            patch = f[row - 2: row + 3, x - 2: x + 3].mean()
            v = (v << 1) | (1 if patch > 170 else 0)
        times.append(v / 100.0 if ok else None)
    # keep a monotonic, plausible sequence
    clean, last = [], -1
    for t in times:
        if t is None or t < last - 0.02 or (last >= 0 and t - last > 2.0): clean.append(None)
        else: clean.append(t); last = t
    json.dump(clean, open(out, "w"))
    good = [t for t in clean if t is not None]
    print(f"frames {len(clean)}, decoded {len(good)}, span {good[0]:.2f}..{good[-1]:.2f} s")
    d = np.diff(good); print("median frame step", round(float(np.median(d)), 4), "max gap", round(float(d.max()), 3))

def resample(take, times_json, t_base, t_end, out, fps=30):
    times = json.load(open(times_json))
    cw, chh, cx, cy = CROP
    ow, oh = cw, chh  # full resolution; the edit scales the main view and crops zooms from it
    src = frames(take, f"crop={cw}:{chh}:{cx}:{cy}", ow, oh, 3)
    enc = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ow}x{oh}", "-r", str(fps),
                            "-i", "-", "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-pix_fmt", "yuv420p", out],
                           stdin=subprocess.PIPE)
    k, cur, cur_t, nxt = 0, None, None, None
    it = iter(zip(src, times))
    n_out = int((t_end - t_base) * fps)
    pending = next(it, None)
    written = 0
    while k < n_out:
        target = t_base + k / fps
        # advance while the next decoded frame is not later than the target (pick the latest frame shown by then)
        while pending is not None and (pending[1] is None or pending[1] <= target + 0.5 / fps):
            if pending[1] is not None: cur = pending[0]
            pending = next(it, None)
        if cur is None:
            cur = pending[0] if pending else np.zeros((oh, ow, 3), np.uint8)
        enc.stdin.write(cur.tobytes()); written += 1; k += 1
    enc.stdin.close(); enc.wait()
    print("resampled", written, "frames")

if __name__ == "__main__":
    if sys.argv[1] == "decode": decode(sys.argv[2], sys.argv[3])
    else: resample(sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), sys.argv[6])
