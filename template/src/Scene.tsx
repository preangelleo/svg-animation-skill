import React from 'react';
import {AbsoluteFill,Audio,staticFile,useCurrentFrame} from 'remotion';
import {Actor,basePose,poseAt,faceAt,walkAt,Look} from './rig/adult';
// Original neutral demo: a curious adult approaches a ball and points at it.
// All clocks derive from the current frame. No network, randomness or wall clock.
export const Scene: React.FC<any> = ({config:c}) => {
 const f=useCurrentFrame(); const t=f/Math.max(1,c.duration_frames-1)*89;
 const x=520+Math.min(t,40)/40*260;
 // Walk distance is rig-local; exactly two full cycles end with both feet planted.
 const distance=Math.min(t,40)/40*260;
 const walk=walkAt(distance/1.22,260/1.22/4,18);
 const p=poseAt(t,[{f:0,p:{...basePose,x,y:850,scale:1.22}}, {f:40,p:{x:780}}, {f:60,p:{armF:{a:105,b:-25},handF:'point',headTilt:-5}}, {f:89,p:{armF:{a:95,b:-15},handF:'point',headTilt:0}}]);
 Object.assign(p,{x,...walk},faceAt(t,[[0,'neutral'],[45,'surprise'],[65,'eager']],c.seed));
 const S=c.style;
 return <AbsoluteFill style={{backgroundColor:S.background}}>
 <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet" style={{fontFamily:S.fontFamily}}>
 <rect width="1920" height="1080" fill={S.background}/><path d="M0 820 Q700 760 1920 835 V1080 H0Z" fill={S.ground}/>
 <circle cx="1250" cy="793" r="58" fill={S.accent} stroke={S.ink} strokeWidth={S.lineWidth}/>
 <path d="M1214 773 Q1250 733 1283 776" fill="none" stroke={S.ink} strokeWidth={S.lineWidth} opacity=".4"/>
 <Actor pose={p} look={c.character as Look} id="demo-adult"/>
 <text x="125" y="145" fontSize="62" fontWeight="600" fill={S.ink}>{c.title}</text>
 </svg>
 {c.audio ? <Audio src={staticFile(c.audio)} volume={1}/> : null}
 </AbsoluteFill>;
};
