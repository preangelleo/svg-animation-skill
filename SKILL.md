---
name: svg-animation-skill
description: Create deterministic SVG character-action clips using a portable Remotion scaffold, with configurable style, exact frames, optional user audio, SRT and metadata. 用可参数化SVG成人骨架制作独立动作短片，供场景工作流调用。
---

# SVG animation skill / SVG人物场景动画

Turn a scene brief, `style_ref`, character/look and action anchors, exact width/height/fps/`duration_frames`, and optional audio/alignment into a character sheet/storyboard, SVG + Remotion actions, checked clip, SRT and metadata. This is a scene tool, not an automatic full-film publishing workflow or a text-to-video API. Read [README](README.md) for the runnable installation and [scene schema](references/scene.schema.json) for parameters.

输入：场景brief、整片style_ref、人物外观/服装、动作锚、精确帧数与尺寸/fps，可选用户音轨及对齐时间。输出：角色/分镜检查、SVG+Remotion动作、自检后的独立clip、SRT和metadata。本技能用于调用workflow的场景subagent，不接管整片发布，也不是文生视频API。

1. Resolve the caller's visual contract: palette, typography, line weight, era, character continuity and crop. Preserve the whole film's style. The neutral demo is a starting example, not a style mandate. 把整片色板、字体、线条、时代和人物连续性落实为参数，不把demo外观当默认品牌。
2. Initialize a project with `node /path/to/svg-animation-skill/scripts/init.mjs ./new-scene`; follow README. Edit `scene.json`, then adapt `src/Scene.tsx` for the requested blocking. The bundled adult rig exposes planted-foot IK, `poseAt`, `faceAt`, `walkAt` and optional alignment-driven `talkAt`. All output must be a pure function of local frame; fix seeds and calculate prop contact in the same coordinate space. 用局部帧纯函数驱动动作，接触点统一坐标系；不要靠推拉静图冒充人物表演。
3. Render and inspect character views and storyboard keyframes before the full clip. Inspect action continuity, feet, hands, occlusions, expressions and first/middle/last decoded frames. Verify exact frame count, dimensions and zero PTS with ffprobe. Check a second style when proving style configurability. 先看角色与分镜，再看动作和真实短片；类型通过不能代替画面验收。
4. Return the independent clip, optional SRT (empty when no subtitles are supplied), metadata with source/config hashes and actual QA limitations to the caller's existing assembly workflow. Audio, SFX and forced alignment are optional external capabilities; silent rendering needs no paid generation account. Do not regenerate frozen narration or alter its timing without instruction. 输出单片并交回既有合成流程；音频/SFX/强制对齐均可选，静默可运行。

Claude Code with `claude-opus-5-5` is recommended for authoring character actions because an adult-rig trial was actually rendered with it. Any capable model/harness, including Codex, may author the code. This portable package was tested on Linux only; other OS/harness combinations are not claimed tested. 模型和harness可替换。每片0–3个SVG场景只是某调用方的可选建议，不是所有使用者的限制。

Keep the upstream MIT notice and separate dependency licenses when redistributing. See [NOTICE](NOTICE) and [provenance](references/source-provenance.json). No credentials, provider clients, publishing operations or private media are needed by the scaffold.
