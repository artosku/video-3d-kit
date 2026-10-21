# Light: theory, six setups, and the "every change has a cause" rule

The videos look like they are shot in a real, controlled set. Light changes mood, so it is a storytelling tool, but **light never changes by itself**: the viewer must see why.

## 1. Short theory
- **Key light direction sets the mood.** Side-top 45° = dramatic but human (Rembrandt, a small triangle of light on the cheek). Straight from the side = torn, pressured. From above = despair (eyes become dark sockets). From below = lonely or eerie (screen light). From behind = silhouette, distance, daydreaming. Soft from the front = relief, safe, happy.
- **Warm vs cool.** Warm (orange) = human, comfortable, proud, relieved. Cool (blue) = distance, loneliness, failure, shame, screens and night. A cool edge from behind (rim light) separates the character from the background.
- **Contrast.** High light:dark ratio = tense or sad; low = happy. Lowering the fill light darkens half the face.
- **Visible sources (practicals)** make a scene believable: a lamp, a screen, a window. Light on a face should have a source in the frame.
- **Never blind the viewer.** White screens and the phone are dimmed by default (pages with theme `warm`/`bright` show at brightness 0.5/0.42; phone light 1.5).

## 2. The six presets (`assets/lighting/presets.json`)
Lights are placed by angle around the lead character's face: `az` (0 front, +90 right, -90 left, 180 behind), `el` (degrees above/below the face), `d` (distance), `i` (intensity). Roles: `key`, `fill`, `rim`, `screen`, plus `hemi` (ambient). Diagrams: `python tools/lighting_diagrams.py` (needs Pillow) → `out/diagram/`.

| preset | what it is | feeling | use for |
|---|---|---|---|
| `rembrandt` (**default**) | warm key side-top (az 48°, el 38°), cool rim from behind, screen from below | sad but calm | the whole video as the base |
| `split` | warm key straight from the side (az 92°), almost no fill | pressured, torn | a dilemma moment |
| `top` | warm key straight from above | despair, cornered, embarrassed | an embarrassing punchline, briefly |
| `screen` | face lit only by a cool screen from below-front, thin warm edge | lonely late night | the lead alone, staring at the screen |
| `silhouette` | window light from behind (az 180°), key nearly off | daydreaming, drifting away | the ending, when the lead looks up |
| `warm` | soft warm light from front-side, low contrast | proud, relieved | success, good news |

## 3. Designing the light curve of a video
1. Start with `rembrandt`; do not change the base without a reason.
2. Mark each big emotion in the script (proud, the fall, shame, relief, daydream).
3. For each one, decide the **visible cause** first, then the light shape.
   | moment | visible cause | light |
   |---|---|---|
   | good news | the screen changes to a warm "success" page | screen glow warms the characters |
   | the painful keyword | **the lamp bulb flickers and dims** | key drops to 12-42%, recovers slowly |
   | self-blame | the lead **turns to the window** (`turn`) | cool window light on the face |
   | exposure/shame | the screen shows a bright white page | cold bright wash on the face |
   | the fix | **the phone rises** | soft phone light on the partner |
   | ending | the lead turns to the window, a **falling star** passes | small light from outside |
4. Write bulb/level/preset changes in `lightEvents` (each needs `cause`). Screen pages, phone, moment outside and `turn` are causes by themselves and need no `lightEvents` entry.

## 4. Event types (`lightEvents`)
- `flicker`: `{ "type":"flicker","at":"L7.start-0.2","dur":1.7,"floor":0.12,"amp":0.55,"to":0.42,"recover":9,"cause":"..." }`. For `dur` seconds the key flickers between `floor` and `floor+amp`, then holds `to` and recovers to 100% over `recover` s. It is its own cause (the bulb is visible in the bedroom world). Use once or twice per video at most. Optional `role` (default `key`).
- `level`: `{ "type":"level","role":"key","at":"...","over":0.6,"to":0.5,"cause":"..." }`. Smoothly sets a role's intensity factor. Roles are listed in the world's `world.json` → `lightRoles`.
- `preset`: `{ "type":"preset","to":"top","at":"...","over":0.8,"cause":"..." }`. Blends to another setup (the bedroom desk lamp moves with the key; when the key goes far above the frame the lamp is simply not drawn). Return to the base with another `preset` event.
- The screen's glow follows the **page shown** automatically (page theme `dark` / `dim` / `warm` / `bright`): the cheapest and strongest cause.
- The phone and the moment outside carry their own light.

## 5. What `validate` checks
- Every `lightEvents` entry needs a non-empty `cause`, a known `role`, and (for `preset`) a known preset name.
- **Strict worlds** (`world.json` → `lightCauseCheck: "strict"`, the bedroom): a `level` or `preset` event must have a visible cause within about 1 s: a screen change, a lamp flicker, the phone rising, the moment outside, or a character turning (`turn` in `directions`). Otherwise validate refuses ("no plot holes").
- **Text worlds** (`"text"`, simple worlds like the outdoor template): only the written `cause` is required, so write a real one the viewer can see (a cloud covers the moon, a campfire flares, a character turns).
- Cause list by world: bedroom = screen page change, lamp flicker, phone, moment outside, turn. Simple worlds = turn, moment outside if the world has one, plus whatever the world draws (name it in `cause`).

## 6. Speaker light
The speaker needs no extra light; the camera angle (`cam`) gives focus. If the partner needs to be brighter, use a real cause (screen turns on, phone).

## 7. Don'ts
- Light changes with no cause; white flashes, strobing, full-screen white.
- Film grain or "noise" for a cinematic feel (the kit has none on purpose).
- Changing the whole base light to a new color (e.g. purple neon) unless the user asks.
