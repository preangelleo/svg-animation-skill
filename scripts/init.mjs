#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dest=process.argv[2];
if(dest==='--help'||dest==='-h'){console.log('Usage: node scripts/init.mjs NEW_PROJECT\nCreates a local scene scaffold; refuses an existing destination.');process.exit(0);}
if (!dest) throw new Error('Usage: node /path/to/skill/scripts/init.mjs NEW_PROJECT');
const out=path.resolve(dest);
if(fs.existsSync(out)) throw new Error('Destination already exists; choose a new project directory.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.cpSync(path.join(root,'template'),out,{recursive:true,errorOnExist:true});
// Public npm checksums are stored as explicit algorithm:hex to avoid a plaza
// false positive on high-entropy base64. Restore standard npm SRI locally.
const projected=path.join(out,'package-lock.integrity-hex.json');
const lock=JSON.parse(fs.readFileSync(projected,'utf8'));
for(const [name,entry] of Object.entries(lock.packages)){
 if(!entry.integrity_hex)continue;
 const [algorithm,hex]=entry.integrity_hex.split(':');
 const lengths={sha512:128,sha256:64,sha1:40};
 if(!lengths[algorithm]||hex.length!==lengths[algorithm]||!/^[0-9a-f]+$/.test(hex))throw new Error('Invalid public npm checksum');
 const integrity=algorithm+'-'+Buffer.from(hex,'hex').toString('base64');
 lock.packages[name]=Object.fromEntries(Object.entries(entry).map(([key,value])=>
  key==='integrity_hex'?['integrity',integrity]:[key,value]));
}
fs.writeFileSync(path.join(out,'package-lock.json'),JSON.stringify(lock,null,2)+'\n');
fs.unlinkSync(projected);
fs.mkdirSync(path.join(out,'public'));
fs.copyFileSync(path.join(root,'references/scene.schema.json'),path.join(out,'scene.schema.json'));
for(const name of ['LICENSE','NOTICE'])fs.copyFileSync(path.join(root,name),path.join(out,name));
fs.cpSync(path.join(root,'references'),path.join(out,'licenses-and-provenance'),{recursive:true});
console.log('Created local scene project:',out);
console.log('Inside it: npm ci --ignore-scripts && npm run still && npm run render');
