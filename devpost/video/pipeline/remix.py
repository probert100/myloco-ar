import json, sys, os, subprocess
import assemble as A
cut, music, out, gain = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
meta = json.load(open(cut + ".json"))
aud = os.path.join(A.WORK, "audio_remix.m4a")
A.mix_audio(meta["timeline"], meta["chimes"], music, meta["total"], aud, music_gain=gain)
A.run([A.FF, "-y", "-hide_banner", "-loglevel", "error", "-i", os.path.join(A.WORK, "video.mp4"), "-i", aud, "-map", "0:v", "-map", "1:a",
       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out])
json.dump(meta, open(out + ".json", "w"))
print("wrote", out)
