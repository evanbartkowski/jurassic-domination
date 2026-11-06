import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const png=await sharp('public/assets/icon.svg').resize(256,256).png().toBuffer();
await writeFile('public/assets/icon.png',png);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=0;header[7]=0;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
await writeFile('public/assets/icon.ico',Buffer.concat([header,png]));
