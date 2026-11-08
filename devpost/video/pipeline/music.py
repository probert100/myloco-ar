import json, os, sys, urllib.request, urllib.error
S = os.path.dirname(os.path.abspath(__file__))
key = os.environ["ELEVENLABS_API"]
length_ms = int(sys.argv[1]); out = sys.argv[2]
prompt = ("Warm, hopeful, modern instrumental underscore for a calm product demo of AR glasses that help you find a friend "
          "in a festival crowd. Soft evolving synth pads, a light plucked arpeggio, gentle muted kick and shaker entering "
          "after about 15 seconds, steady 96 BPM, airy and optimistic, never busy. Lifts slightly with a brighter pulse in "
          "the last 40 seconds for a short technical montage, then resolves to a soft, clean ending. Designed to sit under a "
          "spoken voice-over: no vocals, no lead melody fighting the voice, no big drops.")
body = {"prompt": prompt, "music_length_ms": length_ms, "model_id": "music_v2_5", "force_instrumental": True}
for model in ("music_v2_5", "music_v2", "music_v1"):
    body["model_id"] = model
    req = urllib.request.Request("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_192", data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        data = urllib.request.urlopen(req, timeout=600).read()
        open(out, "wb").write(data); print("ok", model, len(data), "bytes"); break
    except urllib.error.HTTPError as e:
        print(model, "HTTP", e.code, e.read()[:300].decode(errors="replace"))
