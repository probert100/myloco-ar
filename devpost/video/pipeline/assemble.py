"""Assemble the MyLoco AR submission video from a Lens Studio preview recording of the video-tour LEAF scenario.

usage: assemble.py <take.mp4> <anchors.json|auto> <music.mp3> <out.mp4> [--hold-from HH:MM:SS]
anchors.json: [[frame, tour_t], ...] mapping recorded frames to tour time ("auto" = sync frame + constant 30 fps).
"""
import json, os, re, subprocess, sys
S = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(S), "py")); sys.path.insert(0, S)
import numpy as np
import graphics as G
import zoomclips as Z

import imageio_ffmpeg
FF = os.environ.get("FFMPEG") or imageio_ffmpeg.get_ffmpeg_exe()
LOG = os.environ["LS_LOG"]  # the Lens Studio log the video-tour run printed into
REPO = os.path.abspath(os.path.join(S, "..", "..", ".."))
GFX = os.path.join(S, "gfx"); WORK = os.path.join(S, "work"); os.makedirs(WORK, exist_ok=True)
FPS = 30
T_BASE = None
ZOOMS = {}  # segment -> (roi x0,y0,x1,y1 to find the white text in, crop width, dy from text to crop centre, local start, local end)

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(" ".join(cmd)[:2000]); print(r.stderr[-3000:]); sys.exit(1)
    return r

def dur(path):
    r = subprocess.run([FF, "-hide_banner", "-i", path], capture_output=True, text=True)
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)

def wall(s):
    h, m, sec = s.split(":"); return int(h) * 3600 + int(m) * 60 + float(sec)

def parse_tour(hold_from=None):
    lines = open(LOG, errors="replace").read().splitlines()
    starts = [i for i, l in enumerate(lines) if "[Tour] holding" in l and (not hold_from or l[2:14] >= hold_from)]
    i0 = starts[-1] if not hold_from else starts[0]
    marks, info, chimes, t0wall = {}, {}, [], None
    for l in lines[i0:]:
        m = re.match(r"^. (\d\d:\d\d:\d\d\.\d+) ", l)
        if not m: continue
        w = wall(m.group(1))
        if "[Tour] mark " in l:
            g = re.search(r"\[Tour\] mark (\S+) ([\d.]+) lead=([\d.]+) tau0=([\d.]+)", l)
            t = float(g.group(2)); marks[g.group(1)] = t
            if t0wall is None: t0wall = w - t
        elif "[Tour] sync " in l:
            info["sync"] = float(re.search(r"sync ([\d.]+)", l).group(1))
        elif "[Tour] done " in l:
            info["done"] = float(re.search(r"done ([\d.]+)", l).group(1)); break
        elif "[MeetMeThere] chime" in l and "muted" not in l:
            chimes.append(w)
    info["chimes"] = [round(c - t0wall, 3) for c in chimes]
    return marks, info

def retime(take, anchors, out):
    """Write out: 728x1000 @30 fps whose t=0 is tour time T_BASE (piecewise-linear frame→tour-time map)."""
    a = sorted(anchors)
    # extend both ends with the neighbouring rate
    expr = ""
    for (f0, t0), (f1, t1) in zip(a[:-1], a[1:]):
        seg = f"({t0 - T_BASE}+(N-{f0})*{(t1 - t0) / (f1 - f0)})"
        expr += f"if(lt(N,{f1}),{seg},"
    (f0, t0), (f1, t1) = a[-2], a[-1]
    expr += f"({t1 - T_BASE}+(N-{f1})*{(t1 - t0) / (f1 - f0)})" + ")" * (len(a) - 1)
    run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", take, "-an",
         "-vf", f"setpts='({expr})/TB',fps={FPS},scale=728:1000:flags=lanczos",
         "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-pix_fmt", "yuv420p", out])

def build(take, anchors_arg, music, out, hold_from=None):
    global T_BASE
    marks, info = parse_tour(hold_from)
    print("marks", marks); print("info", info)
    T_BASE = info["sync"] + 0.3  # start the real-time track just after the sync cut
    zj = os.path.join(S, "zooms.json")
    if os.path.exists(zj): ZOOMS.update({k: tuple(v) for k, v in json.load(open(zj)).items()})
    rt = os.path.join(WORK, "rt_hi.mp4")
    if anchors_arg == "timecode":
        import timecode
        tj = os.path.join(WORK, "times.json")
        if not os.path.exists(tj): timecode.decode(take, tj)
        if not os.path.exists(rt) or os.path.getmtime(rt) < os.path.getmtime(tj):
            timecode.resample(take, tj, T_BASE, info["done"] + 3.0, rt)
    else:
        retime(take, json.load(open(anchors_arg)), rt)

    V = {k: dur(os.path.join(S, "vo", k + ".mp3")) for k in
         ["s01_intro", "s02_anyone", "s03_arrow", "s04_walk", "s05_near", "s06_stale", "s07_here", "s08_controls",
          "s09_ended", "s10_built", "s11_outro"]}
    m = marks
    # (segment, footage start (tour t) or None, duration, panel, voice, voice offset in segment)
    segs = [
        ("s01", m["s01_intro"], m["s02_anyone"] - m["s01_intro"], "s01_intro", "s01_intro", 0.6),
        ("s02", m["s02_anyone"], m["s03_arrow"] - m["s02_anyone"], "s02_anyone", "s02_anyone", 0.6),
        ("s03", m["s03_arrow"], m["s04_walk"] - m["s03_arrow"], "s03_arrow", "s03_arrow", 0.6),
        ("s04", m["s04_walk"], m["s05_near"] - m["s04_walk"], "s04_walk", "s04_walk", 0.6),
        ("s05", m["s05_near"], m["s06_stale"] - m["s05_near"], "s05_near", "s05_near", 0.3),
        ("s06a", m["s06_stale"], 0.6 + 4.3, "s06_stale", "s06_stale", 0.6),
        ("s06b", m["s06b"], V["s06_stale"] + 1.6 - 4.3, "s06_stale", None, 0),
        ("s07", m["s07_here"], m["s08_controls"] - m["s07_here"], "s07_here", "s07_here", 0.6),
        ("s08", m["s08_controls"], 0.6 + V["s08_controls"] + 0.9, "s08_controls", "s08_controls", 0.6),
        ("s09", m["s09_ended"], 0.3 + V["s09_ended"] + 1.4, "s09_ended", "s09_ended", 0.3),
        ("s10", None, 0.6 + V["s10_built"] + 1.0, None, "s10_built", 0.6),
        ("s11", m["s11_outro"], 0.6 + V["s11_outro"] + 3.6, "s11_outro", "s11_outro", 0.6),
    ]
    # global timeline
    tl, g = [], 0.0
    for name, fs, d, panel, voice, voff in segs:
        tl.append(dict(name=name, fs=fs, d=round(d, 3), panel=panel, voice=voice, vstart=g + voff, g=g)); g += round(d, 3)
    total = g
    print("total", round(total, 2), "s")
    # captions (global times)
    caps = []
    for s in tl:
        if s["voice"] and s["voice"] != "s11_outro":
            for p, a, b in G.captions(s["voice"], s["vstart"], fullscreen=(s["name"] == "s10")):
                caps.append((p, a, b))
    # chimes mapped into the timeline
    chimes = []
    for c in info["chimes"]:
        for s in tl:
            if s["fs"] is not None and s["fs"] <= c < s["fs"] + s["d"]:
                chimes.append(round(s["g"] + c - s["fs"], 3))
    print("chimes at", chimes)

    parts = []
    for s in tl:
        p = os.path.join(WORK, f"seg_{s['name']}.mp4"); parts.append(p)
        local = [(c, a - s["g"], b - s["g"]) for c, a, b in caps if b > s["g"] and a < s["g"] + s["d"]]
        if s["name"] == "s10":
            render_montage(s, local, rt, marks, p)
        else:
            render_footage_seg(s, local, rt, p, total)
    lst = os.path.join(WORK, "concat.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    vid = os.path.join(WORK, "video.mp4")
    run([FF, "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", vid])
    aud = os.path.join(WORK, "audio.m4a")
    mix_audio(tl, chimes, music, total, aud)
    run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", vid, "-i", aud, "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out])
    json.dump(dict(timeline=tl, total=total, chimes=chimes), open(out + ".json", "w"), indent=1)
    print("wrote", out, round(dur(out), 2), "s")

def png_inputs(paths):
    args = []
    for p in paths: args += ["-loop", "1", "-framerate", str(FPS), "-i", p]
    return args

def render_footage_seg(s, caps, rt, out, total):
    d = s["d"]; ss = s["fs"] - T_BASE
    pngs = [os.path.join(GFX, "base.png"), os.path.join(GFX, "frame_mask.png"),
            os.path.join(GFX, f"panel_{s['panel']}.png"), os.path.join(GFX, "footage_label.png")]
    extra = []
    if s["name"] == "s06b": extra.append((os.path.join(GFX, "later20.png"), 0.0, 2.4))
    ov = extra + caps
    pngs += [c for c, a, b in ov]
    zoom = ZOOMS.get(s["name"])
    if zoom: pngs += [os.path.join(GFX, "zoom_frame.png")]
    args = [FF, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{ss:.3f}", "-t", f"{d:.3f}", "-i", rt] + png_inputs(pngs)
    f = "[0:v]setpts=PTS-STARTPTS,scale=728:1000:flags=lanczos,format=rgba[ft];[2:v]format=gray[mk];[ft][mk]alphamerge[fr];"
    f += "[1:v][fr]overlay=110:40[v0];[v0][3:v]overlay[v1];[v1][4:v]overlay[v2]"
    last = "v2"
    for i, (c, a, b) in enumerate(ov):
        f += f";[{last}][{5 + i}:v]overlay=enable='gte(t,{max(0, a):.3f})*lt(t,{b:.3f})'[o{i}]"; last = f"o{i}"
    if zoom:
        roi, box_w, dy, l0, l1 = zoom
        clip = os.path.join(WORK, f"zoom_{s['name']}.mp4")
        Z.make(rt, ss + l0, ss + l1, roi, box_w, dy, clip)
        k = 5 + len(ov)
        args += ["-i", clip]
        zi = 1 + len(pngs)
        f += (f";[{zi}:v]setpts=PTS-STARTPTS+{l0:.3f}/TB[zc]"
              f";[{last}][zc]overlay={G.ZX}:{G.ZY}:eof_action=pass:enable='between(t,{l0:.3f},{l1 - 0.04:.3f})'[z1]"
              f";[z1][{k}:v]overlay=enable='between(t,{l0:.3f},{l1 - 0.04:.3f})'[z2]")
        last = "z2"
    if s["name"] == "s01": f += f";[{last}]fade=t=in:st=0:d=0.5[fi]"; last = "fi"
    if s["name"] == "s11": f += f";[{last}]fade=t=out:st={d - 1.6:.3f}:d=1.6[fo]"; last = "fo"
    args += ["-filter_complex", f, "-map", f"[{last}]", "-t", f"{d:.3f}", "-r", str(FPS),
             "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", out]
    run(args)

def render_montage(s, caps, rt, marks, out):
    d = s["d"]; v0 = s["vstart"] - s["g"]  # voice start inside the segment (0.6)
    from words import words
    ws = [(x[0].strip(".,:"), x[1]) for x in words("s10_built")]
    def at(word, after=0):  # start time of the first `word` at or after index `after`
        i = next(i for i in range(after, len(ws)) if ws[i][0] == word); return i, ws[i][1]
    i_and, t_and = at("and")
    i_sc, t_sc = at("scene")
    i_cap, _ = at("captures")
    _, t_a = at("a", i_cap)
    _, t_all = at("All")
    _, t_even = at("Even")
    b2, b3, b4, b5 = v0 + t_and - 0.15, v0 + t_sc - 0.2, v0 + t_a - 0.25, v0 + t_even - 0.2
    count_at = v0 + t_all
    print("montage beats", round(b2, 2), round(b3, 2), round(b4, 2), round(b5, 2), "count", round(count_at, 2))
    slides = [os.path.join(GFX, f"slide_b{i}.png") for i in range(1, 6)]
    pngs = slides + [os.path.join(GFX, "slide_b4_count.png"), os.path.join(GFX, "frame_mask.png")] + [c for c, a, b in caps]
    pip_ss = marks["s03_arrow"] - T_BASE + 0.4
    args = [FF, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{pip_ss:.3f}", "-t", f"{d:.3f}", "-i", rt] + png_inputs(pngs)
    win = [(0, b2), (b2, b3), (b3, b4), (b4, b5), (b5, d + 1)]
    f = "[1:v]null[v0]"
    last = "v0"
    for i in range(1, 5):
        a, b = win[i]
        f += f";[{last}][{1 + i}:v]overlay=enable='between(t,{a:.3f},{b:.3f})'[s{i}]"; last = f"s{i}"
    f += f";[{last}][6:v]overlay=enable='between(t,{count_at:.3f},{b5:.3f})'[cnt]"; last = "cnt"
    # picture-in-picture of the tour footage on the last slide
    f += f";[0:v]setpts=PTS-STARTPTS+{b5:.3f}/TB,scale=360:495:flags=lanczos,format=rgba[pv];[7:v]scale=360:495,format=gray[pm];[pv][pm]alphamerge[pip]"
    f += f";[{last}][pip]overlay=1340:395:enable='gte(t,{b5:.3f})'[pp]"; last = "pp"
    for i, (c, a, b) in enumerate(caps):
        f += f";[{last}][{8 + i}:v]overlay=enable='gte(t,{max(0, a):.3f})*lt(t,{b:.3f})'[c{i}]"; last = f"c{i}"
    args += ["-filter_complex", f, "-map", f"[{last}]", "-t", f"{d:.3f}", "-r", str(FPS),
             "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p", out]
    run(args)

def mix_audio(tl, chimes, music, total, out, music_gain=0.42, stems=None):
    ins, f, labels = [], "", []
    vo = [s for s in tl if s["voice"]]
    for i, s in enumerate(vo):
        ins += ["-i", os.path.join(S, "vo", s["voice"] + ".mp3")]
        f += f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(s['vstart'] * 1000)}:all=1[v{i}];"; labels.append(f"[v{i}]")
    f += "".join(labels) + f"amix=inputs={len(labels)}:normalize=0,apad=whole_dur={total:.3f},atrim=0:{total:.3f},asplit=2[vo][key];"
    n = len(vo)
    ins += ["-i", music]
    f += (f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{total:.3f},afade=t=in:st=0:d=1.2,afade=t=out:st={total - 3.0:.3f}:d=3.0,"
          f"volume={music_gain}[mu];[mu][key]sidechaincompress=threshold=0.015:ratio=12:attack=30:release=600:makeup=1[duck];")
    chime = os.path.join(REPO, "Assets", "Audio", "chime.wav")
    cl = []
    for j, c in enumerate(chimes):
        ins += ["-i", chime]
        f += f"[{n + 1 + j}:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.5,adelay={int(c * 1000)}:all=1[c{j}];"; cl.append(f"[c{j}]")
    allin = "[vo][duck]" + "".join(cl)
    f += f"{allin}amix=inputs={2 + len(cl)}:normalize=0,atrim=0:{total:.3f},loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.84:attack=3:release=60:level=false[out]"
    run([FF, "-y", "-hide_banner", "-loglevel", "error"] + ins + ["-filter_complex", f, "-map", "[out]",
                                                                    "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", out])

if __name__ == "__main__":
    take, anchors, music, out = sys.argv[1:5]
    hold = sys.argv[sys.argv.index("--hold-from") + 1] if "--hold-from" in sys.argv else None
    build(take, anchors, music, out, hold)
