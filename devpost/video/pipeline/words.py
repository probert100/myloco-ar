import json, os, glob, sys
S = os.path.dirname(os.path.abspath(__file__))
def words(seg):
    a = json.load(open(os.path.join(S, "vo", seg + ".align.json")))
    ch, st, en = a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"]
    out, cur, t0 = [], "", None
    for c, s, e in zip(ch, st, en):
        if c.isspace():
            if cur: out.append((cur, t0, last)); cur = ""
        else:
            if not cur: t0 = s
            cur += c; last = e
    if cur: out.append((cur, t0, last))
    return out
if __name__ == "__main__":
    for f in sorted(glob.glob(os.path.join(S, "vo", "*.align.json"))):
        seg = os.path.basename(f).replace(".align.json", "")
        print(seg, " ".join(f"{w}@{s:.1f}" for w, s, e in words(seg)))
