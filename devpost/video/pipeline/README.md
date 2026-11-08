# Video pipeline

How `devpost/video/MyLocoAR-Meet-Me-There.mp4` was made. Every step was run by the coding agent; nothing was edited by
hand. The ElevenLabs key comes from the environment (`ELEVENLABS_API`) and is not in the repo.

| Step | Script | What it does |
|---|---|---|
| 1. Voice-over | `tts.py` + `narration.json` | ElevenLabs `eleven_v4` TTS per line, with word timestamps (`vo/*.align.json`) |
| 2. Shot list | `Assets/Tests/VideoTourScenario.ts` | LEAF scenario `video-tour`: camera moves and pinches timed to the word timestamps; draws a timecode at the top edge |
| 3. Record | Lens Studio preview → Record Video | Start the scenario, then press Record during its 80 s hold (starting a scenario resets the preview and would discard a running recording) |
| 4. Retime | `timecode.py` | Reads the timecode from every frame and resamples to real-time 30 fps (the recorder stamps frames at 30 fps whatever the render rate), cropping the timecode strip off |
| 5. Graphics | `graphics.py` | Panels, tags, captions (from the word timestamps), build slides, zoom frame |
| 6. Edit | `assemble.py` + `zooms.json` | Cuts each shot at the scenario's `[Tour] mark` log lines, adds panels, captions and zoom callouts (`zoomclips.py` follows the white UI text in the full-res footage), the build montage, the chime at the logged times, and the mix |
| 7. Music | `music.py` (prompt, unused) / ElevenLabs video-to-music (used) | Video-to-music scored the finished picture edit; `remix.py` re-mixes the audio onto it |

Run (macOS, Python 3.9+):

```bash
python3 -m pip install --target devpost/video/py imageio-ffmpeg pillow numpy
```

```bash
cd devpost/video/pipeline && python3 tts.py iP95p4xoKVk53GoZ742B eleven_v4 && python3 graphics.py ../../..
```

```bash
LS_LOG="<Lens Studio log file>" PYTHONPATH=../py python3 assemble.py <recording.mp4> timecode music/<music.mp3> ../MyLocoAR-Meet-Me-There.mp4
```

`assemble.py` takes the last `video-tour` run in the log (or `--hold-from HH:MM:SS`).
