"""Zoom callouts: follow the white UI text (chip name / HUD headline) in the full-res footage and
render a magnified crop of it, so in-lens text is readable at video size. The crop is the real
footage, only magnified."""
import os, subprocess, sys
import numpy as np
from PIL import Image
S = os.path.dirname(os.path.abspath(__file__))
import imageio_ffmpeg
FF = os.environ.get("FFMPEG") or imageio_ffmpeg.get_ffmpeg_exe()
W, H = 1236, 1694
ZW, ZH = 860, 258

def make(rt, t0, t1, roi, box_w, dy, out, fps=30):
    x0, y0, x1, y1 = roi
    p = subprocess.Popen([FF, "-v", "error", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i", rt, "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    frames, cents = [], []
    n = W * H * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        f = np.frombuffer(b, np.uint8).reshape(H, W, 3)
        sub = f[y0:y1, x0:x1]
        m = sub.min(axis=2) > 222
        ys, xs = np.nonzero(m)
        cents.append((xs.mean() + x0, ys.mean() + y0) if len(xs) > 25 else None)
        frames.append(f)
    good = [c for c in cents if c is not None]
    if not good: raise SystemExit(f"zoom {out}: no text found in {roi}")
    # fill gaps, then smooth so the crop glides instead of jittering
    last = good[0]; filled = []
    for c in cents:
        last = c if c is not None else last; filled.append(last)
    a = np.array(filled, np.float64)
    k = 9
    pad = np.pad(a, ((k, k), (0, 0)), mode="edge")
    sm = np.array([pad[i:i + 2 * k + 1].mean(axis=0) for i in range(len(a))])
    box_h = round(box_w * ZH / ZW)
    enc = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ZW}x{ZH}", "-r", str(fps),
                            "-i", "-", "-c:v", "libx264", "-crf", "14", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
    from PIL import ImageDraw
    mask = Image.new("L", (ZW, ZH), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, ZW - 1, ZH - 1), 16, fill=255)
    bg = Image.new("RGB", (ZW, ZH), (16, 19, 26))
    for f, (cx, cy) in zip(frames, sm):
        cy += dy
        l = int(round(min(max(cx - box_w / 2, 0), W - box_w)))
        t = int(round(min(max(cy - box_h / 2, 0), H - box_h)))
        crop = Image.fromarray(f[t:t + box_h, l:l + box_w]).resize((ZW, ZH), Image.LANCZOS)
        enc.stdin.write(Image.composite(crop, bg, mask).tobytes())
    enc.stdin.close(); enc.wait()
    print(f"zoom {os.path.basename(out)}: {len(frames)} frames, text found in {len(good)}")
