import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill,renderMedia} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const mode=process.argv[2]??'render';
if(!['render','still'].includes(mode))throw new Error('Mode must be render or still');
const configPath=path.resolve(root,process.argv[3]??'scene.json');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
for(const k of ['width','height','fps','duration_frames'])if(!Number.isInteger(config[k])||config[k]<1)throw new Error('Invalid positive integer '+k);
if(config.width%2||config.height%2)throw new Error('Use even dimensions for H.264/yuv420p');
if(!config.style||!config.character)throw new Error('style and character required');
for(const s of config.subtitles??[])if(!Number.isInteger(s.start_frame)||!Number.isInteger(s.end_frame)||s.start_frame<0||s.end_frame<=s.start_frame||s.end_frame>config.duration_frames||typeof s.text!=='string')throw new Error('Invalid subtitle frame interval/text');
if(config.audio){if(path.isAbsolute(config.audio)||config.audio.split(/[\\/]/).includes('..'))throw new Error('Audio must be a local relative public/ path');if(!fs.existsSync(path.join(root,'public',config.audio)))throw new Error('Audio missing under public/');}
const output=path.resolve(root,process.argv[4]??(mode==='still'?'keyframe.png':'clip.mp4'));
fs.mkdirSync(path.dirname(output),{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(root,'src/index.tsx'),publicDir:path.join(root,'public')});
const common={serveUrl,inputProps:{config},logLevel:'warn',...(process.env.CHROME_PATH?{browserExecutable:process.env.CHROME_PATH}:{})};
const composition=await selectComposition({...common,id:'Scene'});
const frame=Number(process.argv[5]??Math.min(config.duration_frames-1,60));
if(mode==='still') {if(!Number.isInteger(frame)||frame<0||frame>=config.duration_frames)throw new Error('Frame outside composition');await renderStill({...common,composition,frame,output});}
else {
 await renderMedia({...common,composition,codec:'h264',pixelFormat:'yuv420p',crf:18,outputLocation:output,concurrency:2});
 const stamp=(f)=>{const ms=Math.round(f/config.fps*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
 fs.writeFileSync(output+'.srt',(config.subtitles??[]).map((s,i)=>`${i+1}\n${stamp(s.start_frame)} --> ${stamp(s.end_frame)}\n${s.text}\n`).join('\n'));
}
const hash=(b)=>crypto.createHash('sha256').update(b).digest('hex');
const sourceHashes={};
const collect=(dir)=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,item.name);if(item.isDirectory())collect(f);else sourceHashes[path.relative(root,f).split(path.sep).join('/')]=hash(fs.readFileSync(f));}};
collect(path.join(root,'src'));sourceHashes['render.mjs']=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
const dependencyVersions=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).dependencies;
fs.writeFileSync(output+'.metadata.json',JSON.stringify({schema_version:1,mode,width:config.width,height:config.height,fps:config.fps,duration_frames:config.duration_frames,style_ref:config.style_ref,config_sha256:hash(fs.readFileSync(configPath)),output_sha256:hash(fs.readFileSync(output)),audio:config.audio??null,subtitles:(config.subtitles??[]).length,source_sha256:sourceHashes,dependencies:dependencyVersions},null,2)+'\n');
console.log(output);
