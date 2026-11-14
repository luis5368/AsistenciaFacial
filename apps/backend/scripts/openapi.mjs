// Genera documentación; no carga .env, Prisma ni conexiones de BD.
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { schemas, syncSchema } from '../dist/http/contracts.js';
const components={};
for(const [name,schema] of Object.entries({...schemas,SyncBatch:syncSchema})) components[name]=z.toJSONSchema(schema,{target:'draft-2020-12',io:'input'});
const string={type:'string'};const id={type:'string',format:'uuid'};
const obj=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const ref=name=>({'$ref':`#/components/schemas/${name}`});
components.Error=obj({error:obj({code:string,message:string,requestId:id})});
components.Health=obj({status:{const:'ok',type:'string'}});
components.Profile=obj({id,institutionId:id,role:{enum:['ADMIN','TEACHER']},email:string});
components.Institution=obj({id,name:string});
components.User=obj({id,email:string,role:{enum:['ADMIN','TEACHER']},active:{type:'boolean'}});
components.Teacher=obj({id,userId:id});
components.Assignment=obj({teacherId:id,groupId:id,active:{type:'boolean'}});
components.Student=obj({id,studentCode:string,fullName:string,active:{type:'boolean'}});
components.Group=obj({id,grade:string,section:string,schoolYear:{type:'integer'}});
components.Enrollment=obj({id,studentId:id,groupId:id,startsAt:string,endsAt:{type:['string','null']}});
components.ClassSession=obj({id,groupId:id,startsAt:string,endsAt:string,status:{enum:['PLANNED','OPEN','CLOSED','CANCELLED']}});
components.Device=obj({id,assignedUserId:id,expiresAt:string,revokedAt:{type:['string','null']}});
components.Attendance=obj({id,event_uuid:id,student_id:id,session_id:id,status:{enum:['ACTIVE','VOID']},version:{type:'integer'},received_at_server:string});
components.CorrectionRecord=obj({id,attendanceId:id,fromVersion:{type:'integer'},toVersion:{type:'integer'},fromStatus:string,toStatus:string,reason:string,recordedAt:string});
components.AuditEvent=obj({id,actorId:id,action:string,resourceType:string,resourceId:id,recordedAt:string});
components.AuthSession=obj({profile:ref('Profile'),expiresAt:string,csrfToken:string});
components.SyncResult={type:'object',additionalProperties:false,required:['index','event_uuid','status'],properties:{index:{type:'integer',minimum:0},event_uuid:id,status:{enum:['accepted','already_accepted','needs_review','rejected','retryable_error']},attendance_id:id,version:{type:'integer'},code:string,retryable:{type:'boolean'}}};
components.SyncResponse=obj({results:{type:'array',items:ref('SyncResult')}});
const paths={};
const administrativePath=path=>/^\/(?:institution|me(?:\/assignments)?|(?:users|teachers|students|groups)(?:\/\{id\})?|teachers\/\{id\}\/assignments\/\{groupId\})$/.test(path);
function operation(method,path,body,result,roles=['ADMIN'],status='200'){
 const full='/api/v1'+path;const health=path==='/health';const administrative=administrativePath(path);const implemented=health||path.startsWith('/auth/')||administrative;
 const list=result?.endsWith('[]');const name=list?result.slice(0,-2):result;
 const success=health?ref('Health'):result==='SyncResponse'?ref(result):list?obj({data:{type:'array',items:ref(name)},nextCursor:{type:['string','null']}}):result?obj({data:ref(name),meta:obj({requestId:id})}):undefined;
 const response={description:implemented?'Salud del proceso; no comprueba BD.':'Contrato de etapa futura; ruta NO habilitada.',headers:{'X-Request-Id':{schema:id},'Cache-Control':{schema:{const:'no-store'}}},...(success?{content:{'application/json':{schema:success}}}:{})};
 response.description=health?'Salud del proceso; no comprueba BD.':implemented?'Autenticación HTTPS local; sesiones en memoria.':'Contrato futuro; ruta no habilitada.';
 if(administrative){response.description='Implementado y probado con dobles en laboratorio HTTPS; NO montado en server.ts. Activación PostgreSQL pendiente de autorización y validación real.';if(!list)response.headers.ETag={schema:{type:'string',pattern:'^"[a-f0-9]{64}"$'},description:'ETag canónico sin secretos; GET /me no genera ETag.'};if(status==='201')response.headers.Location={schema:string};}
 if(path.startsWith('/auth/')&&method==='post')response.headers['Set-Cookie']={schema:string,description:'__Host-af_session; HttpOnly; Secure; SameSite=Lax; Path=/; sin Domain. Logout y cambio eliminan cookie.'};
 const op={operationId:method+path.replace(/[^a-zA-Z]/g,''),'x-implemented':implemented,'x-roles':roles,security:health||path==='/auth/login'?[]:[{sessionCookie:[]}],responses:{[status]:response},parameters:[]};
 op['x-runtime-enabled']=implemented&&!administrative;
 op['x-tested']=implemented?'automated-doubles':'not-executed';
 op['x-postgresql-validated']=false;
 if(administrative)op['x-pending-activation']=['real-authentication-postgresql','browser-cookie-validation','explicit-authorization'];
 if(administrative&&!['get','head'].includes(method))op.parameters.push({in:'header',name:'Origin',required:true,schema:string,description:'Origen HTTPS exacto configurado en servidor.'});
 if(path.startsWith('/auth/')&&method==='post')op.parameters.push({in:'header',name:'Origin',required:true,schema:string,description:'Coincidencia exacta con API_ORIGIN HTTPS configurado en servidor.'});
 if(method==='post'&&['/attendances','/attendances/{id}/corrections'].includes(path))op.responses['200']={...response,description:'Reintento idéntico ya aceptado.'};
 for(const code of ['400','401','403','404','409','412','413','415','422','428','429','500','503'])op.responses[code]={description:'Error seguro; no expone configuración ni valores de entrada.',content:{'application/json':{schema:ref('Error')}}};
 for(const match of path.matchAll(/\{([^}]+)\}/g))op.parameters.push({in:'path',name:match[1],required:true,schema:id});
 if(list)op.parameters.push({in:'query',name:'limit',schema:{type:'integer',minimum:1,maximum:100,default:50}},{in:'query',name:'cursor',schema:{type:'string',maxLength:512,pattern:'^[A-Za-z0-9_-]+$'}});
 if(method==='patch'||path.endsWith('/transitions'))op.parameters.push({in:'header',name:'If-Match',required:true,schema:{type:'string',pattern:'^"[a-f0-9]{64}"$'}});
 if(!['get','head'].includes(method)&&path!=='/auth/login')op.parameters.push({in:'header',name:'X-CSRF-Token',required:true,schema:string});
 if(body)op.requestBody={required:true,content:{'application/json':{schema:ref(body)}}};
 (paths[full]??={})[method]=op;
}
const both=['ADMIN','TEACHER'];
operation('get','/health',null,'Health',[]);
operation('head','/health',null,null,[]);
operation('post','/auth/login','Login','Profile',[]);
operation('get','/auth/session',null,'AuthSession',both);
operation('head','/auth/session',null,null,both);
operation('post','/auth/logout',null,null,both,'204');
operation('post','/auth/password-change','PasswordChange',null,both,'204');
operation('get','/institution',null,'Institution',both);operation('patch','/institution','InstitutionPatch','Institution');
operation('get','/me',null,'Profile',both);
for(const [path,name,create,patch,roles] of [['users','User','UserCreate','UserPatch',['ADMIN']],['teachers','Teacher','TeacherCreate',null,['ADMIN']],['students','Student','StudentCreate','StudentPatch',both],['groups','Group','GroupCreate','GroupPatch',both]]){
 operation('get','/'+path,null,name+'[]',roles);operation('get','/'+path+'/{id}',null,name,roles);
 operation('post','/'+path,create,name,['ADMIN'],'201');if(patch)operation('patch','/'+path+'/{id}',patch,name);
}
operation('get','/me/assignments',null,'Assignment[]',['TEACHER']);
operation('get','/teachers/{id}/assignments/{groupId}',null,'Assignment');
operation('put','/teachers/{id}/assignments/{groupId}','AssignmentPut','Assignment');
paths['/api/v1/teachers/{id}/assignments/{groupId}'].put.description='Creación: If-None-Match: *. Actualización: If-Match fuerte obligatorio; no combinación de ambos.';
paths['/api/v1/teachers/{id}/assignments/{groupId}'].put.parameters.push({in:'header',name:'If-Match',schema:string},{in:'header',name:'If-None-Match',schema:{const:'*'}});
paths['/api/v1/teachers/{id}/assignments/{groupId}'].put.responses['201']=paths['/api/v1/teachers/{id}/assignments/{groupId}'].put.responses['200'];
operation('get','/groups/{id}/enrollments',null,'Enrollment[]',both);operation('post','/groups/{id}/enrollments','EnrollmentCreate','Enrollment',['ADMIN'],'201');operation('patch','/enrollments/{id}','EnrollmentPatch','Enrollment');
operation('get','/groups/{id}/sessions',null,'ClassSession[]',both);operation('post','/groups/{id}/sessions','SessionCreate','ClassSession',['ADMIN'],'201');operation('get','/sessions/{id}',null,'ClassSession',both);operation('patch','/sessions/{id}','SessionPatch','ClassSession');operation('post','/sessions/{id}/transitions','SessionTransition','ClassSession',both);
operation('get','/devices',null,'Device[]',both);operation('post','/devices','DeviceCreate','Device',['ADMIN'],'201');operation('post','/devices/{id}/revocation',null,'Device');
operation('post','/attendances','ManualEvent','Attendance',both,'201');operation('post','/sync/attendances','SyncBatch','SyncResponse',both);
operation('get','/sessions/{id}/attendances',null,'Attendance[]',both);operation('get','/attendances/{id}',null,'Attendance',both);operation('post','/attendances/{id}/corrections','Correction','CorrectionRecord',['ADMIN'],'201');operation('get','/attendances/{id}/corrections',null,'CorrectionRecord[]');operation('get','/audit-events',null,'AuditEvent[]');
// HEAD no devuelve cuerpo; salud no requiere autenticación ni tiene errores de dominio.
delete paths['/api/v1/health'].head.responses['200'].content;
for(const method of ['get','head']){const op=paths['/api/v1/health'][method];for(const code of ['401','409','412','422','428','429','503'])delete op.responses[code];op.responses['405']={description:'Método no permitido; Allow: GET, HEAD',content:{'application/json':{schema:ref('Error')}}};}
for(const [path,methods] of Object.entries(paths))if(methods.get&&administrativePath(path.slice('/api/v1'.length))){methods.head=structuredClone(methods.get);methods.head.operationId='head'+path.replace(/[^a-zA-Z]/g,'');for(const response of Object.values(methods.head.responses))delete response.content;}
delete paths['/api/v1/me'].get.responses['200'].headers.ETag;
delete paths['/api/v1/me'].head.responses['200'].headers.ETag;
const spec={openapi:'3.1.0',info:{title:'AsistenciaFacial API local',version:'1.0.0',description:'Salud y auth en runtime local. Administración implementada y probada con dobles, pero x-runtime-enabled=false: rutas no montadas contra PostgreSQL. El resto permanece contractual. x-postgresql-validated=false distingue pruebas con dobles de integración real. JSON máximo 256 KiB. Sesiones en memoria. Refinamientos entre fechas y políticas se validan en runtime/servicio; JSON Schema no los expresa íntegramente.'},paths,components:{schemas:components,securitySchemes:{sessionCookie:{type:'apiKey',in:'cookie',name:'__Host-af_session',description:'Sesión opaca local; hash en memoria, inactividad 30 min, máximo 8 h.'}}}};
writeFileSync(new URL('../../../docs/openapi-v1.json',import.meta.url),JSON.stringify(spec,null,2)+'\n');
