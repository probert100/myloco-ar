"""Title panels, captions and build slides for the MyLoco AR submission video (1920x1080)."""
import json, os, sys, re
S = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(S), "py"))
from PIL import Image, ImageDraw, ImageFont, ImageFilter
sys.path.insert(0, S)
from words import words

OUT = os.path.join(S, "gfx"); os.makedirs(OUT, exist_ok=True)
W, H = 1920, 1080
FX, FY, FW, FH = 110, 40, 728, 1000          # Lens footage frame
RX, RW = 908, 900                            # right column
AV = "/System/Library/Fonts/Avenir Next.ttc"
MENLO = "/System/Library/Fonts/Menlo.ttc"
def av(size, face):  # Bold 0, DemiBold 2, Medium 5, Regular 7, Heavy 8
    return ImageFont.truetype(AV, size, index={"bold": 0, "demi": 2, "medium": 5, "regular": 7, "heavy": 8}[face])
def mono(size, bold=False): return ImageFont.truetype(MENLO, size, index=1 if bold else 0)

BG0, BG1 = (11, 13, 17), (20, 24, 32)
WHITE, BODY, MUTED = (242, 244, 247), (184, 192, 204), (124, 133, 148)
CORAL, YELLOW, GREEN = (255, 110, 90), (245, 197, 66), (74, 222, 128)

def wrap(text, font, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if font.getlength(t) <= width or not cur: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def background():
    # smooth diagonal gradient: dark lower-left, slightly lifted upper-right
    import numpy as np
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    k = np.clip((xx / W) * 0.65 + (1 - yy / H) * 0.35, 0, 1)[..., None]
    arr = np.array(BG0, np.float32) * (1 - k) + np.array(BG1, np.float32) * k
    arr += np.random.default_rng(1).normal(0, 0.8, arr.shape)  # dither against banding
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")

def base():
    im = background().convert("RGBA")
    # soft shadow + frame around the footage
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.rounded_rectangle((FX - 6, FY - 2, FX + FW + 6, FY + FH + 10), 26, fill=(0, 0, 0, 170))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(18)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((FX - 3, FY - 3, FX + FW + 3, FY + FH + 3), 22, outline=(52, 58, 72), width=3)
    im.save(os.path.join(OUT, "base.png"))

def frame_mask():
    m = Image.new("L", (FW, FH), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, FW - 1, FH - 1), 20, fill=255)
    m.save(os.path.join(OUT, "frame_mask.png"))

def pill(d, x, y, text, kind):
    f = av(22, "demi")
    pad, h = 18, 44
    icon = 26 if kind == "leaf" else 0
    w = int(f.getlength(text)) + 2 * pad + icon
    if kind == "leaf":
        d.rounded_rectangle((x, y, x + w, y + h), 22, outline=GREEN, width=2, fill=(74, 222, 128, 28))
        cx, cy = x + pad + 2, y + h // 2  # check mark
        d.line((cx, cy, cx + 6, cy + 7, cx + 18, cy - 7), fill=GREEN, width=4, joint="curve")
        d.text((x + pad + icon, y + 8), text, font=f, fill=GREEN)
    elif kind == "stand-in":
        d.rounded_rectangle((x, y, x + w, y + h), 22, fill=YELLOW)
        d.text((x + pad, y + 8), text, font=f, fill=(30, 26, 10))
    else:
        d.rounded_rectangle((x, y, x + w, y + h), 22, outline=(80, 88, 104), width=2)
        d.text((x + pad, y + 8), text, font=f, fill=BODY)
    return w

def brand(d):
    f1, f2 = av(34, "bold"), av(34, "medium")
    d.text((RX, 58), "MyLoco AR", font=f1, fill=WHITE)
    x = RX + f1.getlength("MyLoco AR")
    d.text((x, 58), "  ·  Meet Me There", font=f2, fill=MUTED)
    d.rectangle((RX, 112, RX + 64, 116), fill=CORAL)

def panel(name, step, title, body, tags=(), sub=None):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    brand(d)
    y = 196
    if step:
        d.text((RX, y), step, font=av(26, "heavy"), fill=CORAL); y += 46
    ft = av(60, "bold")
    for line in wrap(title, ft, RW):
        d.text((RX, y), line, font=ft, fill=WHITE); y += 72
    y += 18
    fb = av(32, "regular")
    for line in wrap(body, fb, RW - 20):
        d.text((RX, y), line, font=fb, fill=BODY); y += 46
    y += 30
    x = RX
    for text, kind in tags:
        f = av(22, "demi")
        w = int(f.getlength(text)) + 36 + (26 if kind == "leaf" else 0)
        if x + w > RX + RW: x = RX; y += 58
        x += pill(d, x, y, text, kind) + 14
    if sub:
        d.text((RX, 790), sub, font=av(22, "medium"), fill=MUTED)
    im.save(os.path.join(OUT, f"panel_{name}.png"))

def footage_label():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = av(19, "demi"); t = "LENS STUDIO PREVIEW · SPECS 27 · ONE EYE"
    w = f.getlength(t) + 28
    d.rounded_rectangle((FX + 16, FY + 16, FX + 16 + w, FY + 16 + 36), 18, fill=(0, 0, 0, 150))
    d.text((FX + 30, FY + 22), t, font=f, fill=(230, 233, 238))
    im.save(os.path.join(OUT, "footage_label.png"))
    # "+20 s" jump-cut tag, centred on the footage
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = av(30, "bold"); t = "20 seconds later"
    w = f.getlength(t) + 44; x0 = FX + (FW - w) / 2
    d.rounded_rectangle((x0, FY + 70, x0 + w, FY + 70 + 54), 27, fill=(0, 0, 0, 170))
    d.text((x0 + 22, FY + 78), t, font=f, fill=WHITE)
    im.save(os.path.join(OUT, "later20.png"))

def captions(seg, voice_offset, fullscreen=False):
    """One PNG per phrase; returns [(png, start, end)] in seconds from the segment's voice start + offset."""
    ws = words(seg)
    phrases, cur = [], []
    for w, s, e in ws:
        cur.append((w, s, e))
        txt = " ".join(x[0] for x in cur)
        if re.search(r"[.,:;!?]$", w) and len(txt) > 18 or len(txt) > 62:
            phrases.append(cur); cur = []
    if cur: phrases.append(cur)
    out = []
    f = av(40, "demi")
    for i, ph in enumerate(phrases):
        text = " ".join(x[0] for x in ph)
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        if fullscreen:
            lines = wrap(text, f, 1640)
            y = 1040 - 52 * len(lines)
            for ln in lines:
                lw = f.getlength(ln); x = (W - lw) / 2
                d.rounded_rectangle((x - 18, y - 4, x + lw + 18, y + 50), 12, fill=(0, 0, 0, 165))
                d.text((x, y), ln, font=f, fill=WHITE); y += 52
        else:
            lines = wrap(text, f, RW - 40)
            y = 1004 - 54 * len(lines)
            d.rectangle((RX, y + 6, RX + 6, 1000), fill=CORAL)
            for ln in lines:
                d.text((RX + 30, y), ln, font=f, fill=WHITE); y += 54
        p = os.path.join(OUT, f"cap_{seg}_{i:02d}.png"); im.save(p)
        start = ph[0][1] + voice_offset
        end = (phrases[i + 1][0][1] if i + 1 < len(phrases) else ph[-1][2] + 0.6) + voice_offset
        out.append((p, round(start, 3), round(end, 3)))
    return out

# ---------- build slides (segment 10) ----------
def slide_base(kicker, title):
    im = background().convert("RGBA"); d = ImageDraw.Draw(im)
    f1, f2 = av(30, "bold"), av(30, "medium")
    d.text((110, 62), "MyLoco AR", font=f1, fill=WHITE)
    d.text((110 + f1.getlength("MyLoco AR"), 62), "  ·  how it was built", font=f2, fill=MUTED)
    d.rectangle((110, 112, 174, 116), fill=CORAL)
    d.text((110, 168), kicker, font=av(26, "heavy"), fill=CORAL)
    d.text((110, 206), title, font=av(64, "bold"), fill=WHITE)
    return im, d

def card(d, box, fill=(23, 27, 36), outline=(48, 54, 68)):
    d.rounded_rectangle(box, 22, fill=fill, outline=outline, width=2)

def slides(repo):
    # B1 plan-lens
    im, d = slide_base("1 · PLAN", "Planned with the plan-lens skill")
    d.text((110, 300), "The Devpost Learn skill pack interviewed me and wrote an approved design brief:", font=av(32, "regular"), fill=BODY)
    d.text((110, 344), "the one spatial moment, where things live, and 5 done criteria.", font=av(32, "regular"), fill=BODY)
    card(d, (110, 420, 1810, 900))
    brief = open(os.path.join(repo, "devpost", "design-brief.md")).read().splitlines()
    pick = [l for l in brief if l.startswith("#") or re.match(r"^[1-5]\. ", l)]
    y = 450
    for l in pick[:11]:
        bold = l.startswith("#")
        t = l.lstrip("# ") if bold else l
        f = mono(24, bold)
        t = t if f.getlength(t) < 1620 else t[: int(len(t) * 1620 / f.getlength(t)) - 1] + "…"
        d.text((150, y), t, font=f, fill=WHITE if bold else BODY); y += 38
    im.convert("RGB").save(os.path.join(OUT, "slide_b1.png"))

    # B2 CLAD + MCP
    im, d = slide_base("2 · BUILD", "CLAD skills + the Lens Studio MCP")
    card(d, (110, 330, 930, 900)); card(d, (990, 330, 1810, 900))
    d.text((150, 360), "CLAD skills (ls-clad)", font=av(30, "demi"), fill=CORAL)
    d.text((1030, 360), "Lens Studio MCP tools", font=av(30, "demi"), fill=CORAL)
    skills = ["lens-studio-router", "lens-studio-field-notes", "specs-project-init", "editor-api", "materials",
              "scene-construction", "specs-build-ui", "preview-inspection", "specs-leaf-install-packages",
              "specs-leaf-write-scenarios", "specs-leaf-run-in-preview"]
    tools = ["VirtualScene", "ExecuteEditorCode", "scene-graphql · asset-graphql", "RecompileTypeScriptTool",
             "RunAndCollectLogsTool", "CapturePanelScreenshotTool", "CaptureRuntimeViewTool", "QueryRuntimeSceneTool",
             "PreviewInteractTool · MovePreviewCamera", "PreviewPanelTool", "list/run_leaf_scenario"]
    for i, s in enumerate(skills): d.text((150, 412 + i * 43), s, font=mono(25), fill=WHITE)
    for i, s in enumerate(tools): d.text((1030, 412 + i * 43), s, font=mono(25), fill=WHITE)
    im.convert("RGB").save(os.path.join(OUT, "slide_b2.png"))

    # B3 see-and-fix loop with real preview captures
    im, d = slide_base("3 · SEE AND FIX", "Bootstrap, compile, read logs, look")
    steps = ["VirtualScene", "RecompileTypeScriptTool", "RunAndCollectLogsTool", "CaptureRuntimeViewTool"]
    x = 110
    for i, s in enumerate(steps):
        f = mono(25, True); w = f.getlength(s) + 40
        d.rounded_rectangle((x, 318, x + w, 370), 14, fill=(32, 37, 48), outline=(70, 78, 96), width=2)
        d.text((x + 20, 328), s, font=f, fill=WHITE); x += w
        if i < len(steps) - 1:
            d.text((x + 14, 318), "\u2192", font=ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 36), fill=CORAL); x += 62
    shots = sorted(f for f in os.listdir(os.path.join(repo, "devpost", "screenshots")) if f.endswith(".png"))
    tw, th = 222, 305
    for i, f in enumerate(shots[:7]):
        t = Image.open(os.path.join(repo, "devpost", "screenshots", f)).convert("RGB").resize((tw, th), Image.LANCZOS)
        m = Image.new("L", (tw, th), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, tw - 1, th - 1), 14, fill=255)
        x0 = 110 + i * (tw + 21); im.paste(t, (x0, 420), m)
    card(d, (110, 752, 1810, 900), fill=(14, 17, 23))
    logs = ["[MeetMeThere] state=live-far-live", "[MeetMeThere] band=near distance=63.7m",
            "[FriendFeed] state=ended (stopped)"]
    for i, l in enumerate(logs):
        d.text((150, 770 + i * 42), l, font=mono(26), fill=(150, 220, 170))
    im.convert("RGB").save(os.path.join(OUT, "slide_b3.png"))

    # B4 LEAF
    im, d = slide_base("4 · TEST", "A LEAF test for every done criterion")
    rows = [("dc1-beacon-at-start", "beacon ~600 ft, chip live, updates as she walks"),
            ("dc2-walk-closer-bands", "far pillar, near marker + ring, here ring, HUD in view"),
            ("dc3-off-view-arrow", "arrow on her side when turned away, gone when back"),
            ("dc4-signal-lost-restore", "hollow, \"last seen N s ago\" counting, Restore: live"),
            ("dc5a-end-share", "fades out, \"Maya stopped sharing\" in view"),
            ("dc5b-mute-toggles-chime", "muted cue is silent, Unmute plays the next"),
            ("ik-reach-wearer-controls", "IK arm reaches every button, 0 diagnostics")]
    card(d, (110, 330, 1810, 900))
    for i, (sid, what) in enumerate(rows):
        y = 356 + i * 76
        cx, cy = 160, y + 20
        d.line((cx, cy, cx + 9, cy + 10, cx + 28, cy - 11), fill=GREEN, width=6, joint="curve")
        d.text((210, y), sid, font=mono(30, True), fill=WHITE)
        d.text((760, y + 4), what, font=av(28, "regular"), fill=BODY)
        d.text((1690, y + 2), "PASS", font=av(28, "heavy"), fill=GREEN)
    im.convert("RGB").save(os.path.join(OUT, "slide_b4.png"))
    big = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dd = ImageDraw.Draw(big)
    f = av(64, "heavy"); t = "7 / 7 pass"
    dd.text((1810 - f.getlength(t), 206), t, font=f, fill=GREEN)
    big.save(os.path.join(OUT, "slide_b4_count.png"))

    # B5 the tour itself is a LEAF scenario (code left, footage PiP right)
    im, d = slide_base("5 · THIS VIDEO", "The camera moves are a LEAF scenario")
    card(d, (110, 330, 1170, 900), fill=(14, 17, 23))
    d.text((150, 356), "Assets/Tests/VideoTourScenario.ts", font=mono(24, True), fill=MUTED)
    src = open(os.path.join(repo, "Assets", "Tests", "VideoTourScenario.ts")).read().splitlines()
    i0 = next(i for i, l in enumerate(src) if "// 3. Turn away" in l)
    code = [l[4:] for l in src[i0 : i0 + 11]]
    y = 410
    for l in code:
        col = (120, 130, 150) if l.strip().startswith("//") else (210, 220, 235)
        d.text((150, y), l[:66], font=mono(24), fill=col); y += 42
    d.text((1340, 345), "The shot it produced:", font=av(26, "demi"), fill=MUTED)
    im.convert("RGB").save(os.path.join(OUT, "slide_b5.png"))

def outro_panel():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    brand(d)
    d.text((RX, 300), "Meet me there.", font=av(92, "bold"), fill=WHITE)
    d.text((RX, 420), "One friend, one light, in the real world.", font=av(36, "medium"), fill=BODY)
    y = 560
    for t in ["Built for Learn AR with SPECS (Devpost)",
              "Lens Studio 5.24 · SPECS 27 preview",
              "Claude Code + CLAD + Lens Studio MCP · LEAF 7/7 pass",
              "Voice-over and music generated with ElevenLabs"]:
        d.text((RX, y), t, font=av(28, "regular"), fill=MUTED); y += 44
    im.save(os.path.join(OUT, "panel_s11_outro.png"))

ZX, ZY, ZW, ZH = RX, 586, 860, 258   # zoom box (right column)
def zoom_assets():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((ZX, ZY - 42), "IN THE LENS, ZOOMED", font=av(20, "demi"), fill=MUTED)
    d.rounded_rectangle((ZX - 3, ZY - 3, ZX + ZW + 3, ZY + ZH + 3), 18, outline=CORAL, width=3)
    im.save(os.path.join(OUT, "zoom_frame.png"))
    m = Image.new("L", (ZW, ZH), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, ZW - 1, ZH - 1), 16, fill=255)
    m.save(os.path.join(OUT, "zoom_mask.png"))

if __name__ == "__main__":
    repo = sys.argv[1]
    zoom_assets()
    base(); frame_mask(); footage_label()
    P = [
        ("s01_intro", "01", "Find one friend in a crowd",
         "Maya shared her location from the MyLoco phone app. On SPECS she is a coral light over her real position.",
         [("Done criterion 1 · dc1-beacon-at-start", "leaf")]),
        ("s02_anyone", "02", "Only the seeker wears SPECS",
         "Maya needs only the MyLoco app: no Snapchat, no account. Her share link expires on its own.", []),
        ("s03_arrow", "03", "Out of view: one small arrow",
         "Turn away and a chevron at the edge points back to her. Nothing else in view.",
         [("Done criterion 3 · dc3-off-view-arrow", "leaf")]),
        ("s04_walk", "04", "Distance and freshness, live",
         "A new fix about every 2 s, smoothed against GPS noise. On SPECS: the glasses' location and compass.",
         [("PREVIEW STAND-IN: yellow panel", "stand-in"), ("Done criterion 2 · dc2-walk-closer-bands", "leaf")]),
        ("s05_near", "05", "Closer: a marker inside a ring",
         "The ring is both phones' GPS error added together. Look inside the circle, don't trust a pin.",
         [("Done criterion 2 · dc2-walk-closer-bands", "leaf")]),
        ("s06_stale", "06", "Old data looks old",
         "No fix for 20 s: the marker goes hollow and \"last seen N s ago\" counts up. Restore: live again.",
         [("PREVIEW STAND-IN: Signal lost", "stand-in"), ("Done criterion 4 · dc4-signal-lost-restore", "leaf")]),
        ("s07_here", "07", "Close now: look around",
         "A ring around you and one line of text. Eyes up, phone in your pocket.",
         [("Done criterion 2 · dc2-walk-closer-bands", "leaf")]),
        ("s08_controls", "08", "Two controls: Mute and End",
         "Everything a phone does better was cut.",
         [("Done criterion 5 · dc5b-mute-toggles-chime", "leaf"), ("ik-reach-wearer-controls", "leaf")]),
        ("s09_ended", "09", "Share ended",
         "The beacon fades out and says so. Nothing pretends she's still there.",
         [("PREVIEW STAND-IN: End share", "stand-in"), ("Done criterion 5 · dc5a-end-share", "leaf")]),
    ]
    for name, step, title, body, tags in P:
        panel(name, step, title, body, tags)
    outro_panel()
    slides(repo)
    print("ok", len(os.listdir(OUT)), "files")
