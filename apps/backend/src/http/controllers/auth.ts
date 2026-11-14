import { Router } from 'express';
import type { Response } from 'express';
import type { AuthService } from '../../modules/auth/service.js';
import { schemas } from '../contracts.js';
import { parseDto } from '../validation.js';
import { HttpError } from '../errors.js';
const cookieName='__Host-af_session';
const options={httpOnly:true,secure:true,sameSite:'lax' as const,path:'/'};
export function cookie(header:string|undefined):string|undefined {
  const found=(header??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(cookieName+'='));
  if(found.length!==1)return;
  const token=found[0]!.slice(cookieName.length+1);
  return /^[A-Za-z0-9_-]{43}$/.test(token)?token:undefined;
}
function clear(res:Response){res.clearCookie(cookieName,options);}
export function authRoutes(auth:AuthService,origin:string){
  if(!origin.startsWith('https://'))throw new Error('Autenticación requiere HTTPS local.');
  const router=Router();
  router.use('/api/v1/auth',(req,_res,next)=>{
    parseDto(schemas.Empty,req.query);
    if(['GET','HEAD'].includes(req.method)&&req.body!==undefined)return next(new HttpError('INVALID_REQUEST'));
    if(!req.secure)return next(new HttpError('FORBIDDEN'));
    // Origin obligatorio en mutaciones: evita login CSRF incluso sin sesión previa.
    if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)return next(new HttpError('CSRF_FAILED'));
    next();
  });
  router.post('/api/v1/auth/login',async(req,res)=>{
    const body=parseDto(schemas.Login,req.body);
    const result=await auth.login(body.email,body.password,req.socket.remoteAddress??'unknown',cookie(req.headers.cookie));
    res.cookie(cookieName,result.token,{...options,maxAge:8*60*60_000});
    res.json({data:result.profile,meta:{requestId:res.locals.requestId}});
  });
  router.get('/api/v1/auth/session',async(req,res)=>{
    parseDto(schemas.Empty,req.query);
    const data=await auth.session(cookie(req.headers.cookie));
    res.json({data,meta:{requestId:res.locals.requestId}});
  });
  router.post('/api/v1/auth/logout',async(req,res)=>{
    parseDto(schemas.Empty,req.body??{});
    await auth.logout(cookie(req.headers.cookie),req.get('X-CSRF-Token'));
    clear(res);res.status(204).end();
  });
  router.post('/api/v1/auth/password-change',async(req,res)=>{
    const body=parseDto(schemas.PasswordChange,req.body);
    await auth.changePassword(cookie(req.headers.cookie),req.get('X-CSRF-Token'),body.currentPassword,body.newPassword);
    clear(res);res.status(204).end();
  });
  return router;
}
