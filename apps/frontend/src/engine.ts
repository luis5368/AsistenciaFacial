import * as ort from 'onnxruntime-web/wasm';
import { nms, similarity, type Face, type Point } from './math';

export const MODEL_VERSION = 'yunet-2023mar_sface-2021dec';
const SIZE=640;
function canvas(width: number,height: number) { const c=document.createElement('canvas'); c.width=width;c.height=height;return c; }
export function pixelsToCHW(image: ImageData, bgr: boolean) {
  const n=image.width*image.height, data=new Float32Array(3*n);
  for(let i=0;i<n;i++){ data[i]=image.data[4*i+(bgr?2:0)];data[n+i]=image.data[4*i+1];data[2*n+i]=image.data[4*i+(bgr?0:2)]; }
  return data;
}
export function decode(outputs: Record<string, {data: ArrayLike<number>}>, scale: number): Face[] {
  const faces: Face[]=[];
  for(const stride of [8,16,32]) {
    const cls=outputs[`cls_${stride}`]?.data,obj=outputs[`obj_${stride}`]?.data,box=outputs[`bbox_${stride}`]?.data,kps=outputs[`kps_${stride}`]?.data;
    const cols=SIZE/stride;
    if(!cls||!obj||!box||!kps||cls.length!==cols*cols) throw new Error(`Salidas YuNet incompatibles, stride ${stride}`);
    for(let i=0;i<cls.length;i++) {
      const score=Math.sqrt(Math.max(0,Math.min(1,cls[i]))*Math.max(0,Math.min(1,obj[i])));
      if(score<0.85) continue;
      const row=Math.floor(i/cols),col=i%cols;
      const cx=(col+box[4*i])*stride,cy=(row+box[4*i+1])*stride,w=Math.exp(box[4*i+2])*stride,h=Math.exp(box[4*i+3])*stride;
      const points: Point[]=Array.from({length:5},(_,j)=>[(col+kps[i*10+2*j])*stride/scale,(row+kps[i*10+2*j+1])*stride/scale]);
      if(![cx,cy,w,h,...points.flat()].every(Number.isFinite)) continue;
      faces.push({box:[(cx-w/2)/scale,(cy-h/2)/scale,w/scale,h/scale],points,score});
    }
  }
  return nms(faces);
}

export class BiometricEngine {
  private detector?: ort.InferenceSession;
  private recognizer?: ort.InferenceSession;
  async initialize() {
    ort.env.wasm.numThreads=1;
    ort.env.wasm.wasmPaths='/ort/';
    const start=performance.now();
    try {
      this.detector=await ort.InferenceSession.create('/models/face_detection_yunet_2023mar.onnx',{executionProviders:['wasm']});
      const detected=performance.now();
      this.recognizer=await ort.InferenceSession.create('/models/face_recognition_sface_2021dec.onnx',{executionProviders:['wasm']});
      return {yunetLoadMs:detected-start,sfaceLoadMs:performance.now()-detected};
    } catch(error) {await this.dispose();throw error;}
  }
  async extract(source: HTMLCanvasElement) {
    if(!this.detector||!this.recognizer) throw new Error('Preparar modelos primero');
    const start=performance.now();
    const input=canvas(SIZE,SIZE), ctx=input.getContext('2d')!;
    const scale=Math.min(SIZE/source.width,SIZE/source.height);
    ctx.fillStyle='black';ctx.fillRect(0,0,SIZE,SIZE);
    ctx.drawImage(source,0,0,source.width*scale,source.height*scale);
    const data=pixelsToCHW(ctx.getImageData(0,0,SIZE,SIZE),true);
    const detectionInput=new ort.Tensor('float32',data,[1,3,SIZE,SIZE]);
    let faces: Face[];
    try {
      const output=await this.detector.run({[this.detector.inputNames[0]]:detectionInput});
      try {
        const numeric:Record<string,{data:Float32Array}>={};
        for(const [key,tensor] of Object.entries(output)) {
          if(!(tensor.data instanceof Float32Array))throw new Error('Salida YuNet no float32');
          numeric[key]={data:tensor.data};
        }
        faces=decode(numeric,scale).filter(f=>f.points.every(([x,y])=>x>=0&&x<source.width&&y>=0&&y<source.height));
      }finally{Object.values(output).forEach(t=>t.dispose());}
    }finally{detectionInput.dispose();input.width=0;}
    const detectionMs=performance.now()-start;
    if(faces.length!==1) return {faces,embedding:null,detectionMs,embeddingMs:0};
    const [a,b,tx,ty]=similarity(faces[0].points);
    const aligned=canvas(112,112), actx=aligned.getContext('2d')!;
    actx.fillStyle='black';actx.fillRect(0,0,112,112);
    actx.setTransform(a,b,-b,a,tx,ty);actx.drawImage(source,0,0);actx.resetTransform();
    const recognitionStart=performance.now();
    // OpenCV FaceRecognizerSF uses RGB raw values; normalization is inside this ONNX.
    const tensor=new ort.Tensor('float32',pixelsToCHW(actx.getImageData(0,0,112,112),false),[1,3,112,112]);
    let embedding: Float32Array;
    try {
      const features=await this.recognizer.run({[this.recognizer.inputNames[0]]:tensor});
      try {
        const values=features[this.recognizer.outputNames[0]].data;
        if(!(values instanceof Float32Array))throw new Error('Salida SFace no float32');
        embedding=Float32Array.from(values);
      }finally{Object.values(features).forEach(t=>t.dispose());}
    }finally{tensor.dispose();aligned.width=0;}
    if(embedding.length!==128 || !embedding.every(Number.isFinite)) throw new Error('Embedding SFace inválido');
    return {faces,embedding,detectionMs,embeddingMs:performance.now()-recognitionStart};
  }
  async controlEmbedding() {
    if(!this.recognizer) throw new Error('SFace no inicializado');
    const input=new ort.Tensor('float32',new Float32Array(3*112*112).fill(128),[1,3,112,112]);
    const start=performance.now();
    try {
      const result=await this.recognizer.run({[this.recognizer.inputNames[0]]:input});
      try {
        const data=result[this.recognizer.outputNames[0]].data;
        if(!(data instanceof Float32Array)||data.length!==128||!data.every(Number.isFinite))throw new Error('Salida de control SFace inválida');
        return {controlDimensions:data.length,controlSfaceMs:performance.now()-start};
      }finally{Object.values(result).forEach(t=>t.dispose());}
    }finally{input.dispose();}
  }
  async dispose() {await this.detector?.release();await this.recognizer?.release();this.detector=undefined;this.recognizer=undefined;}
}
