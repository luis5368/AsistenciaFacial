import { describe, expect, it } from 'vitest';
import { choose, cosine, nms, reference, similarity, type Face } from './math';

describe('comparación y rechazo',()=>{
  it('no confunde coseno con probabilidad',()=>{expect(cosine([1,0],[1,0])).toBe(1);expect(cosine([1,0],[0,1])).toBe(0);expect(cosine([1,0],[-1,0])).toBe(-1);});
  it('rechaza vectores inválidos',()=>{expect(()=>cosine([0,0],[1,0])).toThrow();expect(()=>cosine([NaN],[1])).toThrow();expect(()=>cosine([1],[1,2])).toThrow();});
  it('no identifica sin perfiles o bajo umbral',()=>{expect(choose(new Float32Array([1,0]),[],.5).state).toBe('unknown');expect(choose(new Float32Array([1,0]),[{id:'adulto',embedding:new Float32Array([0,1])}],.5).id).toBeNull();});
  it('rechaza ambigüedad y acepta solo candidato separado',()=>{const probe=new Float32Array([1,0]);expect(choose(probe,[{id:'a',embedding:probe},{id:'b',embedding:probe}],.5).state).toBe('ambiguous');expect(choose(probe,[{id:'a',embedding:probe}],.5).state).toBe('candidate');});
  it('valida umbral',()=>{expect(()=>choose(new Float32Array([1]),[],NaN)).toThrow();});
});
describe('geometría',()=>{
  it('recupera escala y traslación para alineación de cinco puntos',()=>{const source=reference.map(([x,y])=>[x*2+20,y*2-10] as [number,number]);const [a,b,x,y]=similarity(source);expect(a).toBeCloseTo(.5);expect(b).toBeCloseTo(0);expect(x).toBeCloseTo(-10);expect(y).toBeCloseTo(5);});
  it('rechaza landmarks degenerados',()=>expect(()=>similarity(Array.from({length:5},()=>[0,0]))).toThrow());
  it('NMS conserva cajas separadas y la mejor repetida',()=>{const face=(x:number,score:number):Face=>({box:[x,0,10,10],points:[],score});expect(nms([face(0,.8),face(0,.9),face(30,.7)]).map(f=>f.score)).toEqual([.9,.7]);});
});
