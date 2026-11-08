import json, os, sys, base64, urllib.request, urllib.error
S = os.path.dirname(os.path.abspath(__file__))
key = os.environ["ELEVENLABS_API"]
voice = sys.argv[1]; model = sys.argv[2]; only = sys.argv[3:] 
segs = json.load(open(os.path.join(S, "narration.json")))
os.makedirs(os.path.join(S, "vo"), exist_ok=True)
for i, s in enumerate(segs):
    if only and s["id"] not in only: continue
    body = {"text": s["text"], "model_id": model,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.15, "use_speaker_boost": True, "speed": 1.0}}
    if model not in ("eleven_v3", "eleven_v4", "eleven_v4_turbo"):
        if i > 0: body["previous_text"] = segs[i-1]["text"]
        if i < len(segs)-1: body["next_text"] = segs[i+1]["text"]
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_192",
        data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        d = json.load(urllib.request.urlopen(req, timeout=120))
    except urllib.error.HTTPError as e:
        print(s["id"], "HTTP", e.code, e.read()[:400]); sys.exit(1)
    open(os.path.join(S, "vo", s["id"] + ".mp3"), "wb").write(base64.b64decode(d["audio_base64"]))
    json.dump(d.get("normalized_alignment") or d.get("alignment"), open(os.path.join(S, "vo", s["id"] + ".align.json"), "w"))
    al = d.get("alignment") or {}
    print(s["id"], "ok, ends at", (al.get("character_end_times_seconds") or [0])[-1], "s")
