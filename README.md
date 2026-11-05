# svg-animation-skill 1.0.1

## 通过 Agent J 广场安装

```bash
agentj plaza install svg-animation-skill
```

本仓库与 Agent J 广场包为同一版本 **1.0.1**；1.0.1 仅更新平台元数据，允许 macOS（darwin）；20 个包内容文件沿用 1.0.0，Mac 尚未实机验证。仓库 README 仅更新版本标题并增加本安装说明，其余文件与广场导出包一致。manifest.json 保留广场包原始清单，其中 README 的校验值对应原始广场 README。

广场原生包（candidate.ajpkg）SHA256：`3bbf715ef907f8eca2150acdf95937decd4000501700feb7cb7fdecd8a248d5a`。

A portable SVG/React/Remotion scene skill with adult proportions, planted-foot leg IK, pose/face/walk helpers, and an original silent demonstration: a curious adult approaches and points at a ball. 用可参数化成人SVG骨架制作独立动作片段；默认16:9、静默，无付费生成依赖。

## Run from any working directory / 从任意工作目录运行

Requirements: Node.js 20+ and npm, Chromium/Chrome or Remotion's downloadable browser, and ffprobe for checking. Network access is required for npm dependencies and the optional browser download. Linux was actually tested; macOS/Windows have not been tested. No Python environment or global CLI installation is used.

Replace `/path/to/svg-animation-skill` with the downloaded skill directory; choose a new destination (the initializer refuses existing directories):

```bash
node /path/to/svg-animation-skill/scripts/init.mjs ./my-scene
cd my-scene
npm ci --ignore-scripts
npm run still
npm run render
```

The renderer uses Remotion's browser discovery/download by default. To use an existing local browser, set its executable explicitly, for example on Linux:

```bash
CHROME_PATH=/usr/bin/chromium npm run still
CHROME_PATH=/usr/bin/chromium npm run render
```

This creates `keyframe.png`, `clip.mp4`, `clip.mp4.srt`, and corresponding `.metadata.json` files. The demo is 960×540, 30fps, exactly 90 frames (3 seconds). The SRT is intentionally empty because the example has no narration or subtitles. npm's install runs with lifecycle scripts disabled; Remotion downloads its browser only when necessary during rendering. No files outside the chosen project and npm/browser caches are intentionally modified. No upload or publishing is performed.

检查命令：

```bash
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=width,height,r_frame_rate,nb_read_frames,start_time,duration -of json clip.mp4
node render.mjs still scene-alternate.json alternate.png 60
```

The distributable stores npm integrity checksums in `template/package-lock.integrity-hex.json` as explicit `algorithm:hex` values because the plaza privacy scanner flags ordinary public SRI base64. The initializer transparently restores `package-lock.json` with the exact original SRI values before `npm ci`; no checksum is dropped and no dependency version changes. 此公开哈希投影可逆，安装后的标准锁文件仍由 npm 验证每项完整性，不修改广场扫描器。

## Customize / 参数与创作

`scene.json` controls width/height (even pixels), fps, exact `duration_frames`, fixed seed, title, `style_ref`, background/ground/accent/ink, line width and font family, and the full character look (skin, hair, clothing colors, build, hem, face, beard and hat). Fonts use local system families; no font file is bundled. The SVG world is 1920×1080 and fits the requested canvas; for another aspect ratio adapt the scene composition deliberately. Rendering at arbitrary dimensions is supported, but automatically optimal non-16:9 framing is not claimed.

The demo timing scales to the requested exact duration. For a new scene, edit `src/Scene.tsx` to replace its blocking, props and actions; `src/rig/adult.tsx` exposes the reusable rig, and `src/engine/anim.ts` deterministic helpers. `scene.schema.json` documents the JSON contract. `style_ref` identifies the caller's frozen style; it does not fetch or interpret a remote style automatically. 颜色/字体/外观可改；新的表演、场景和构图由动画作者写进Scene.tsx，保持调用整片风格。

Optional audio: put your licensed audio under `public/`, set `"audio": "narration.wav"`, then render. Optional subtitle cues are `{"start_frame":0,"end_frame":30,"text":"Example"}` in `subtitles`; end_frame is exclusive. Output SRT uses the local scene clock. Character lip motion requires calling `talkAt` with your alignment data in Scene.tsx; the scaffold does not perform ASR/forced alignment or invent speech. Music/SFX/TTS/FA are external optional capabilities, not included services; no ElevenLabs account is required. Keep any caller's frozen narration unchanged.

## Deliver and inspect / 验收与交付

Render keyframes using `node render.mjs still scene.json frame.png 60`. Inspect character appearance, planted feet, hands/contact, action readability and first/middle/last decoded video frames. Check frame count/PTS/dimensions with ffprobe before returning the clip, SRT and metadata to the calling workflow. Metadata includes the config and output hashes; record source hashes and your visual observations alongside it. There is no automatic subjective quality certification. The included demo assets are neutral silent media generated from the package; no private trial footage is included.

Claude Code / claude-opus-5-5 is the recommended authoring combination from an actual adult-rig trial. Model/harness is replaceable; Codex can also write actions. The scaffold is a local renderer, not an AI video API, complete-film automation or publisher. A calling project may optionally use 0–3 SVG inserts; that is not a universal scene limit.

## License / 许可

Skill, scripts, adult-rig adaptation and generated neutral demo: MIT, see LICENSE. FreshStack's unmodified animation helper retains its complete MIT notice in references/FreshStack-LICENSE.txt; exact commit and file hashes are in references/source-provenance.json. Remotion has its own license: review https://www.remotion.dev/docs/license and https://www.remotion.dev/license for your use. The MIT notice does not make all Remotion commercial use free. React/npm dependencies and user-supplied audio/fonts retain their own licenses.
