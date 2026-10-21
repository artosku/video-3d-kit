# Writing the script (`script.json`)

Two characters talk in turn. Lines are short (3-8 words), spoken, and the humor or feeling comes from honesty and from pauses.

## 1. File shape
```json
[
 { "who": "ayam",   "text": "I finally built the app.", "tone": "sad_soft", "gap": 0.3 },
 { "who": "claude", "text": "I know. I wrote the code.", "tone": "flat",     "gap": "normal" }
]
```
- `who`: a character id from `project.json` (`characters[0]` sits left and is the lead, `characters[1]` sits right).
- `text`: exactly what is said and shown as subtitle (one line, 2 at most; subtitles carry no speaker label).
- `tone`: a name from that character's `character.json` → `tones` (see `audio.md`). Optional. Explicit `speed` / `volume` / `level` on the line override the tone.
- `gap`: seconds of silence BEFORE the line. A number, or a name from `assets/gaps.json`:

| name | s | use |
|---|---|---|
| `tight` | 0.3 | quick back-and-forth |
| `normal` | 0.5 | default |
| `breath` | 0.9 | a beat to react |
| `tense` | 1.1 | something heavy is coming |
| `before_punchline` | 1.9 | the pause that sells the joke |

## 2. Story formula (3 acts, 18-26 lines, about 45-65 s)
1. **Setup + hope (lines 0-6).** The lead opens with a feeling (sad, proud, curious). The partner answers plainly. Give ONE piece of good news so the fall hurts.
2. **The fall (lines 7-15).** One painful keyword (a number, a name, a word) said slowly after a pause. The partner repeats the fact honestly and calmly. The lead defends or blames themself; the partner answers with cold logic.
3. **Punchline + closing (lines 16-22).** The partner asks ONE simple question that exposes the real, easy-to-fix cause. Long pause (`before_punchline`), then the lead's weak answer. The partner solves it in one word. Silence, then the standard ending (lead turns to the window and looks up, see `direction.md` → `ending`).

## 3. Adapting any topic
1. Find the **gap** that is funny: big effort vs small result, plan vs reality, big question vs trivial answer.
2. Pick the **painful keyword** and put it at the end of act 1.
3. Pick the **simple cause** the partner reveals with one question (it must be something easily fixable).
4. Pick the partner's **one-word fix** for the end.
5. Plan what the screen/world shows for each big emotion (`direction.md`, `light-theory.md`).
- Facts and numbers come only from what the user said. Anything invented is comedy fiction: say so in `facts` (see `direction.md`) when `rules.numbersNeedFacts` is on.

## 4. Line style
- One idea per line, about 70 characters at most (validate warns above that).
- Write how people talk, in the project's language (`project.json` → `language`): contractions, small filler words, no formal wording; formal text sounds like a robot.
- The partner: facts, piercing questions, flat repetition. Never shouts, never cruel. Humor comes from accuracy.
- The lead: raw feelings. May trail off (`...`), repeat, ask back, defend with wrong logic.
- **Pauses are half the comedy.** `...` at the start of a line drops the voice; `!` raises it; `.` lowers it; a comma breaks a long line so it does not start too high.
- Very short lines at high speed can lose their last letter: if a voice cuts one off, add a period at the end of the text (`"Done."`) and rebuild that line.
- If the project has `rules.requirePhrases` (optional), put at least one of those exact phrases in a partner line, ideally right after the lead asks something in despair, or as the one-word closing line.

## 5. Estimating length before any voice is made
- About **2.6 s per line** including pauses. 22 lines ≈ 57 s of dialogue, plus `tail` (default 4 s) = video length.
- Over 65 s? Cut repetition from act 2 (only if the story still works). `rules.durationHint` (optional) only warns, it never blocks.

## 6. What to show the user for approval (always, before spending voice credits)
- A compact table: `#`, who, line, tone, gap.
- Estimated length in seconds, in plain words ("about 1 minute").
- 3 short bullets in plain words: the painful moment, the punchline, how the ending looks.
- Then STOP and wait for "OK" or edits. Do not call the voice service before that.

## 7. Short example (Indonesian; the demo episode `episodes/ep01-cuma-lima`)
| # | who | line | tone | gap |
|---|---|---|---|---|
| 0 | ayam | Claude... ... Aku udah bikin aplikasinya. | sad_soft | 0.3 |
| 1 | claude | Aku tahu. Aku yang nulis kodenya. | flat | 0.55 |
| 2 | ayam | Postinganku viral! | proud | 0.45 |
| 3 | claude | Berapa views? | flat | 0.35 |
| 4 | ayam | Dua ratus... ribu. | proud_slow | 0.3 |
| 6 | claude | Terus. Berapa yang download? | flat_soft | 1.1 |
| 7 | ayam | ...Lima. | weak | 1.0 |
| 8 | claude | Lima dari dua ratus ribu. | flat_slow | 0.9 |
| 15 | ayam | Jadi aku harus gimana? | tired_question | 0.9 |
| 17 | claude | Link-nya... ada di bio? | flat_soft | 0.9 |
| 18 | ayam | ...Bio-nya kosong. | weak_whisper | **1.9** |
| 22 | claude | Beres. | flat | 0.3 |
Gap: huge effort (200k views) vs tiny result (5 downloads); painful keyword "...Lima."; simple cause (empty bio link); one-word fix "Beres.". The existing demo script uses explicit `speed`/`volume`/`level` values instead of `tone` names.
