import * as THREE from 'three';
import meshes from './botany-meshes-v4.json' with { type: 'json' };

// Blender-authored buffers, shared across chunks. No per-instance mesh loading.
export const BOTANY = Object.fromEntries(Object.entries(meshes).map(([kind, levels]) => [kind, levels.map(data => {
  const geometry = new THREE.BufferGeometry();
  for (const attribute of ['position', 'normal', 'color']) {
    const bytes = Uint8Array.from(atob(data[attribute]), c => c.charCodeAt(0));
    const values = attribute === 'position' ? new Int16Array(bytes.buffer) : attribute === 'normal' ? new Int8Array(bytes.buffer) : bytes;
    const divisor = attribute === 'position' ? 5000 : attribute === 'normal' ? 127 : 255;
    geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(Float32Array.from(values, value => value / divisor), 3));
  }
  if(data.uv){const bytes=Uint8Array.from(atob(data.uv),c=>c.charCodeAt(0));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(bytes.buffer),2));}
  geometry.userData.botany = kind;
  geometry.computeBoundingSphere();
  return geometry;
})]));
// Small ground cover spends its budget on silhouette, while near hero trees
// retain the full mesh. These are geometry LODs, not simulation density changes.
for (const levels of Object.values(BOTANY)) for (const geometry of levels) geometry.userData.levels = levels;
