# Movement data repository

This directory is the source of truth for exercise content inside the application repository. It contains JSON data and documentation, with no React components, camera code, executable expressions, or detection rules. A separate Git repository, CMS, and cloud service are not required.

## Files

| Location                       | Purpose                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `exercises/<id>.json`          | One exercise, both languages, provenance, requirements and defaults          |
| `collections/primary-1-3.json` | Ordered list of offered movements and equipment/position/jumping constraints |
| `routines/*.json`              | Bilingual starter combinations referencing exercise IDs                      |
| `assets/<id>.json`             | Schematic illustration geometry, optionally with demonstration frames        |
| `messages/feedback.json`       | Stable feedback keys with English and Traditional Chinese wording            |
| `categories.json`              | Category names in both languages                                             |

The pilot offers 17 movements, selected by `collections/primary-1-3.json`. Its audience is Primary 1–3, one student at a time; each exercise specifies a front or side camera view. It includes only standing movements without equipment or jumping. All 36 previous exercise IDs remain in this repository, alongside 13 new definitions; 32 records remain drafts. Existing histories continue to resolve their names, illustrations, notes and exports.

## Expanded pilot movements

| Movement                          | Practice support                | Reason for inclusion                                                        |
| --------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Overhead reaches / 雙手向上伸展   | Experimental automatic counting | A simple reach-and-return pattern, distinct from shoulder-height arm raises |
| Elbow bends / 屈伸手肘            | Experimental automatic counting | A small-space bend-and-straighten pattern with upper arms at the sides      |
| Alternating knee lifts / 交替提膝 | Teacher-marked attempts         | Alternating sides at the teacher's pace; one lift and return is one attempt |
| Side step / 側步                  | Teacher-marked attempts         | A small step-and-close in each direction; one step-and-close is one attempt |

All four include bilingual instructions and user-controlled schematic demonstration stages. Knee lifts and side steps have no automatic technique score or repetition target. A frontal camera does not reliably establish knee-lift depth, foot contact, or whether a child is hopping; the teacher observes these movements and explicitly finishes each step. Automatic arm profiles require visible shoulders, elbows, wrists, hips, knees, and ankles; they count a complete down → movement → down cycle. The thresholds are experimental projected geometry, not validated technique or suitability assessments.

Two additional starter combinations are bundled: **Reach and bend** (overhead reaches → elbow bends → standing balance) and **Step and lift** (side step → alternating knee lifts → standing balance). The default automatic targets are four repetitions and five seconds of balance; these are editable software defaults. Manual steps finish when the teacher chooses, with the marked attempts stored separately from automatic repetitions.

Background references support exploring simple movement patterns: the [primary PE programme of study](https://www.gov.uk/government/publications/national-curriculum-in-england-physical-education-programmes-of-study/national-curriculum-in-england-physical-education-programmes-of-study) includes balance and coordination; [NHS movement-break suggestions](https://bedslutonchildrenshealth.nhs.uk/neurodiversity-support/a-whole-person-approach/exercise-and-movement-for-neurodivergent-children-and-young-people/) include reaching upwards; and [Berkshire Healthcare attention guidance](https://www.berkshirehealthcare.nhs.uk/advice/independence-and-school-readiness/paying-attention) includes marching on the spot. These sources do not validate this catalogue, its targets, or its detection thresholds. The new instructions and illustrations are studio-authored pending teacher review; the adapted side-step record retains its original provisional poster provenance.

## Requested morning movements

Ten definitions extend the pilot; all are teacher-reviewed practice with `analysisProfileId: null`, pending content review, and manual completion. Instructions and illustration frames are bilingual/schematic; they do not establish age-specific validation. No new automatic counter is claimed for these movements.

| Requested activity | Catalogue entries                                                         | Starter combination |
| ------------------ | ------------------------------------------------------------------------- | ------------------- |
| 原地踏步與高抬腿   | `march-in-place`, `high-knees`                                            | 原地踏步與高抬腿    |
| 肩頸與雙臂繞圈伸展 | `shoulder-circles`, `clasped-overhead-stretch`, `clasped-forward-stretch` | 肩膀繞圈與雙手伸展  |
| 站姿貓牛式變化     | `standing-cat-cow`                                                        | 晨間動作組合        |
| 側體與腰部扭轉     | `hand-on-hip-side-stretch`, `standing-twists`                             | 側體伸展與腰部扭轉  |
| 單手叉腰側體引導   | The same `hand-on-hip-side-stretch` entry                                 | 叉腰側體與髖部活動  |
| 雙手叉腰髖部畫圈   | `hip-circles`                                                             | 叉腰側體與髖部活動  |
| 叉腰側提膝         | `side-knee-lifts`                                                         | 叉腰側體與髖部活動  |

The five new combinations also include **晨間動作組合 / Morning movement**, an eight-step sequence through the first four requested activities. Combinations reference the individual entries instead of becoming separate exercises. Existing `knee-lifts` remains the lower-lift option, and `bend` remains the generic automatic side-bend exercise; their IDs and historical meaning stay intact. The clasped overhead stretch is distinct from the existing automatic overhead reach because hand position and stretching are reviewed by the teacher.

This is an adaptation of the user's supplied descriptions and references ([GirlStyle](https://girlstyle.com/tw/article/512137/懶人運動-10分鐘晨操), [GQ Taiwan](https://www.gq.com.tw/article/晨間伸展運動)), not a transcription or endorsement of their health claims. For the current child-facing pilot: teachers choose repetitions and comfortable range; a level thigh is optional; shoulder circles do not add neck circles; hands rest lightly on the hip instead of pressing into the lower back; hip circles stay small; cat–cow does not require looking at the ceiling or forcing chin-to-chest. Fat-loss, pain-relief, back-protection, circulation and nervous-system claims are not presented as measured outcomes.

Side views are requested for high knees, shoulder circles, forward clasped-hand stretches and standing cat–cow. The remaining entries use a front view. Shoulder/hip rotation, spinal curvature, breathing, hand contact, balance and depth remain teacher observations. Each record explains what counts as a manually marked attempt; default target `0` means teacher-controlled completion, not zero required movement.

## Exercise fields

See `exercises/arms.json` for a complete editable example. The runtime schema and checks live in `src/catalog/schema.ts` and `src/catalog/index.ts`.

| Field               | Meaning                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `schemaVersion`     | Currently `1`                                                                 |
| `id`                | Stable lowercase identifier; do not rename IDs already used by history        |
| `category`          | A key in `categories.json`                                                    |
| `publication`       | `draft`, `published`, or `archived`; availability requires `published`        |
| `contentReview`     | `pending` or `reviewed`; independent of publication and automatic tracking    |
| `intendedAudience`  | Intended collection audiences; this is not evidence of validated suitability  |
| `source`            | Origin, reference, and provenance status                                      |
| `requirements`      | Equipment list, standing/floor/inverted position, jumping flag, camera view   |
| `defaults`          | Integer target and `seconds`/`reps`; manual-review definitions use target `0` |
| `analysisProfileId` | An implemented profile ID, or `null` for manual review                        |
| `presentation`      | Theme color and illustration ID, or `null` when no illustration exists        |
| `locales`           | Complete `en` and `zh-Hant` names, subtitles, instructions, and focus text    |

**Published means included in a pilot, not professionally approved.** Content review is currently pending for every entry. The AI-generated poster's provenance remains `provisional`, including the standing-balance entry adapted for this pilot. All implemented analysis profiles are experimental and have empty validated-audience lists. Do not change these statuses to imply validation based on software tests.

## Editing and adding content

1. Edit an existing JSON record, or create `exercises/<new-id>.json`. Keep identifiers stable and supply both languages. Mark new material as draft with pending review and accurate provenance.
2. Reference a bundled illustration, or use `null`. Figure assets contain `head`, `arms`, `legs`, and `torso`; line assets contain `head` and `lines`. An optional `frames` list supplies schematic demonstration stages, one per instruction. Playback interpolates those poses in `src/lib/illustrationTween.ts`; arm and leg segments turn without shrinking, and optional arrow annotations fade. Line assets use a torso, two arms, two legs, then optional annotations. Keep corresponding limb/line order consistent across frames. Figure paths with matching SVG commands interpolate; incompatible shapes switch discretely. The renderer stays generic and animation never supplies landmarks to camera analysis.
3. For automatic feedback, reference an existing compatible profile only if it measures the intended movement. Different detection behavior requires an analyzer implementation and tests in `src/analysis/`. A name or instruction change cannot teach the pose model a new movement.
4. To offer a movement, update its publication/audience fields and the active collection's ordered ID list. Every entry must satisfy that collection's equipment, position, and jumping constraints. Validation rejects inconsistent collections instead of quietly admitting a movement.
5. Edit starter combinations in `routines/`, using active exercise IDs and compatible targets. Combinations are sequences, never exercise records. Teacher-created combinations remain in local storage rather than these files.
6. Run `npm test` and `npm run build`. Run `npm run test:e2e` when changing availability, practice behavior, or the editing workflow. The catalogue tests intentionally protect the agreed pilot selection; update that expectation only when the product scope changes.

The loader automatically discovers exercise, asset, and starter-routine JSON files. The application currently selects `primary-1-3.json` explicitly; supporting multiple selectable collections would require a UI/configuration change. Catalogue validation executes at application initialization and in unit tests; bundling alone does not execute the validation checks.

## Feedback and analysis boundaries

`messages/feedback.json` supplies text referenced by stable keys in analyzer code. Edit wording without renaming the keys. `src/catalog/feedback.ts` also translates historical English cues; if changing old wording, preserve needed aliases for historical translations. General interface labels stay in the application language file.

`src/analysis/profiles.ts` declares implemented profile capabilities and validation scope; `src/analysis/registry.ts` connects them to functions. Geometry, confidence thresholds, phase detection, and quality checks belong in those modules. They do not belong in exercise JSON. The registry/profile consistency test prevents a content reference from claiming a missing implementation.

## Withdrawing a movement

Remove the ID from the active collection and mark the definition draft or archived. Preserve its definition and ID for history. Old combinations containing unavailable or unknown IDs remain visible, list the unavailable steps, and cannot start until the teacher explicitly edits them. The app never silently replaces a step. The same collection boundary applies to the library, selector, next-exercise action, combination builder, and session start.

Session `reps` now records complete visible cycles independently of technique; `alignedReps` records cycles meeting all checks. Older records without `alignedReps` retain their original meaning and are not rewritten. Live repetition counting requires 100 ms of visible evidence at each endpoint and tolerates up to 750 ms of missing intermediate tracking. Longer gaps, pauses, and seeking reset incomplete cycles. Brief missing frames never supply an unseen endpoint and still disqualify the stricter alignment count. Overhead-reach and elbow-bend tracking acquires at confidence 0.6 and releases below 0.5; other profiles keep their existing confidence rules. Child-facing coaching uses a separate 350 ms buffer; raw measurements are not replaced by buffered feedback. Hold credit still depends on the shape checks.
