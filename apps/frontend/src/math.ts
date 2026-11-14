export type Point = [number, number];
export type Face = { box: [number, number, number, number]; points: Point[]; score: number };
export const reference: Point[] = [[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]];

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (!a.length || a.length !== b.length) throw new Error('Dimensiones incompatibles');
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) throw new Error('Vector no finito'); dot += a[i]*b[i]; aa += a[i]*a[i]; bb += b[i]*b[i]; }
  if (aa < 1e-12 || bb < 1e-12) throw new Error('Vector nulo');
  return Math.max(-1, Math.min(1, dot / Math.sqrt(aa*bb)));
}

// Least-squares similarity: x'=a*x-b*y+tx; y'=b*x+a*y+ty (no reflection).
export function similarity(src: Point[], dst: Point[] = reference): [number, number, number, number] {
  if (src.length !== 5 || dst.length !== 5 || src.flat().some(v => !Number.isFinite(v))) throw new Error('Landmarks inválidos');
  const mean = (p: Point[]) => [p.reduce((s,v)=>s+v[0],0)/5,p.reduce((s,v)=>s+v[1],0)/5];
  const [sx,sy]=mean(src), [dx,dy]=mean(dst);
  let den=0, real=0, imag=0;
  src.forEach(([x,y],i)=>{x-=sx;y-=sy;const u=dst[i][0]-dx,v=dst[i][1]-dy;den+=x*x+y*y;real+=x*u+y*v;imag+=x*v-y*u;});
  if (den < 1e-8) throw new Error('Landmarks degenerados');
  const a=real/den,b=imag/den;
  if (a*a+b*b < 1e-10) throw new Error('Alineación degenerada');
  return [a,b,dx-a*sx+b*sy,dy-b*sx-a*sy];
}

export function iou(a: Face, b: Face) {
  const [x,y,w,h]=a.box,[u,v,p,q]=b.box;
  const intersection=Math.max(0,Math.min(x+w,u+p)-Math.max(x,u))*Math.max(0,Math.min(y+h,v+q)-Math.max(y,v));
  return intersection/(w*h+p*q-intersection || 1);
}
export function nms(faces: Face[], threshold=0.3): Face[] {
  const candidates=[...faces].sort((a,b)=>b.score-a.score).slice(0,5000), kept: Face[]=[];
  for(const face of candidates) if(kept.every(other=>iou(face,other)<=threshold)) kept.push(face);
  return kept;
}
export function choose(probe: Float32Array, profiles: { id: string; embedding: Float32Array }[], threshold: number, margin=0.05) {
  if(!Number.isFinite(threshold)||threshold < -1||threshold > 1) throw new Error('Umbral inválido');
  const scores=profiles.map(p=>({id:p.id,score:cosine(probe,p.embedding)})).sort((a,b)=>b.score-a.score);
  if(!scores.length) return { state:'unknown' as const, score:null, id:null };
  const top=scores[0];
  if(top.score<threshold) return {state:'unknown' as const,score:top.score,id:null};
  if(scores[1] && top.score-scores[1].score<margin) return {state:'ambiguous' as const,score:top.score,id:null};
  return {state:'candidate' as const,...top};
}
