# Lessons learned (read before every episode; ADD a line here whenever an episode teaches something new)

The rule: after each episode, write what went wrong or what the user corrected here (and in the right guide), commit it to the kit. The skill improves every time.

## Voices and spelling
- English letters inside Indonesian speech: respell for TTS, keep the caption normal. API -> "eipiai", VPN -> "vipien" (caption stays "VPN").
- A hyphen makes TTS pause: write "garagara", "loncatloncat" for the voice; the caption keeps "gara-gara", "loncat-loncat".
- When a take has an extra sound or wrong pace: `episode.py variants <slug> <line>` (as written / fast / faster / fastest), user picks, `lock`.
- Meme clips from older episodes (e.g. "Apaan tuh?") can be cut and locked as a take.

## Looks
- Ayam faces with beak > 0 (happy, delighted, surprised) hide the lipsync when ayam speaks: use determined, neutral, squint, pleading, sheepish.
- Subtitles always `top`. Put screens at a camera where the subtitle is clear of the heads (fov 57, pos y 5.8 z 12.2, look y 5.4).
- No AI-rendered text. All text by code. No real brands.

## Outside the window
- LED banner (`banner.style:"led"`): keep it small (`w` 7.5, `h` 4.8), dim (`lit` 0.45), `noBeacons:true`, height 30, y 11.2, x about +1.2. Too high = hidden behind subtitles; too far left = cut by the window frame; too bright = glare. ALWAYS look at one still at the alarm moment before a render.
- `cameos`: small sprites jumping outside the window (easter eggs), timed to lines.

## Screens
- `vpnmap` (world map, hopping countries, `alert:true` = red alarm) and `vpnflow` (diagram steps synced to line times) are page types in `worlds/bedroom/studio.js`.
- Sync a diagram step to the line that says it (road at the "tol" line, encryption at "dienkripsi", server at the server line).

## Sound and music
- Sound and music follow `audio.md` section 6 (code-made). No AI sound generation unless asked.
- Music cue: `tools/make_cue.py <slug> --cut <siren time - 0.4>`; REGENERATE it whenever the siren / ending moves.
- A siren (library `siren_wail`) can carry the ending joke; music must stop before it.

## Ending and render
- Do not use a `blackout` light event: frames after it render blank and QA fails ("blank frames"). Use `python tools/post_fx.py tvoff <in> <out> --collapse 0.18` after `video` (picture squashes to a line, then a dot, then 2 s black, power-down sound). Slower collapse (0.4) felt too slow.
- Normal ending is the vibecoder-joke gong; ep17 ended with siren + camera fall + tvoff instead.
- After changing rig / acts / world delete `out/<slug>/frames` (the cache goes stale).
- Render the video in the background and wait for the notification; the mp4 is invalid (no moov atom) until the render finishes.

## Workflow with the user
- Script first, wait for OK; ACC the stills before the full render; show ONE test still when moving something outside the window.
- Always give full absolute Windows paths. Do not push the kit to GitHub until the user says so. Copy finals to `G:\My Drive\Artosku-Videos\3D\Potrait\`.

## Sound and music: what worked in ep17 (copy this recipe)
- SFX per beat (earshot names): `es_hover_tick_detent` on every map hop (only until the diagram appears), `es_pro_zip_up` when the screen switches to the diagram, `es_toggle_latch` on "dienkripsi" (lock), `es_shimmer_m1` on the server step, `es_pro_pop_bloop` on "pantas lokasinya loncat", `es_pro_notify_ding_1930` / `es_pro_pop_chirp` / `es_ui_pop_blip` for the WiFi spy and ad-tracker pop-ups. One small sound per visual change, never two at once, always right on the frame the picture changes.
- No sfx on the ending screens: let the music, then the siren, carry them.
- Music: calm kalimba arpeggio, `rms` 330 so the voices stay clear; sections follow the story (intro, groove while the map hops, explain thinner and an octave lower, tense before the twist, resolve). It must stop BEFORE the siren (`--cut` = siren time - 0.4).
- Ending sequence order that worked: siren starts (SIR) -> alarm screen turns red with a light event -> camera-fall effect + whoosh + thud at SIR + 6.1 -> tvoff post effect -> 2 s black. Meme-style sounds (thud from ep06) are fine to reuse.
- Meme voice clips are mixed louder (level 1.9) so they land over the music.
- Loudness check after `video`: about -16 LUFS, peak under -1 dB (`ffmpeg -i <mp4> -af ebur128=peak=true -f null -`). Ep17 v7: -16.6 LUFS.
- Honest limit: I cannot hear the result. After the mix, say which sounds I placed and ask the user to listen for: too loud, wrong moment, too many at once. Record their answers here.
