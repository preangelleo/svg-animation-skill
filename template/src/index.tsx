import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Scene} from './Scene';
const defaults={width:960,height:540,fps:30,duration_frames:90};
const Root=()=> <Composition id="Scene" component={Scene} width={960} height={540} fps={30} durationInFrames={90} defaultProps={{config:defaults}} calculateMetadata={({props})=>({width:props.config.width,height:props.config.height,fps:props.config.fps,durationInFrames:props.config.duration_frames})}/>;
registerRoot(Root);
