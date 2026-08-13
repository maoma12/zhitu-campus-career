export const JOB_TARGET_LIMIT = 10;
export type JobTarget={id:string;name:string;jdText:string;createdAt:string;updatedAt:string;analyzedText?:string};
const text=(value:unknown)=>typeof value==="string"?value:"";
export function normalizeJobTargets(value:unknown):JobTarget[]{
  if(!Array.isArray(value))return[];
  return value.filter(x=>x&&typeof x==="object").slice(0,JOB_TARGET_LIMIT).map((raw,index)=>{const x=raw as Record<string,unknown>;const id=text(x.id)||`job-migrated-${index}`;const name=text(x.name).trim()||`岗位 ${index+1}`;return{id,name,jdText:text(x.jdText),createdAt:text(x.createdAt),updatedAt:text(x.updatedAt),analyzedText:text(x.analyzedText)||undefined}});
}
export function addJobTarget(items:JobTarget[],target:JobTarget){return items.length>=JOB_TARGET_LIMIT?{items,added:false}:{items:[...items,target],added:true}}
export function renameJobTarget(items:JobTarget[],id:string,name:string){const clean=name.trim().slice(0,40);return clean?items.map(x=>x.id===id?{...x,name:clean,updatedAt:new Date().toISOString()}:x):items}
export function deleteJobTarget(items:JobTarget[],id:string,selected:string[]=[]){return{items:items.filter(x=>x.id!==id),selected:selected.filter(x=>x!==id)}}
export function isJobAnalysisStale(target:JobTarget){return Boolean(target.analyzedText!==undefined&&target.analyzedText!==target.jdText)}
