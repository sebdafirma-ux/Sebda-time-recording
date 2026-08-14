import type {AdminData,AdminResource,Bootstrap,Report,Summary} from './types'
const demo:Bootstrap={user:{name:'Jan Kowalski',role:'foreman',crewId:'crew-1'},sites:[{id:'site-1',name:'Osiedle Zielone'}],buildings:[{id:'building-1',name:'Budynek A',parentId:'site-1'},{id:'building-2',name:'Budynek B',parentId:'site-1'}],crews:[{id:'crew-1',name:'Brygada Kowalskiego'}],crewSites:{'crew-1':['site-1']},todayMinutes:0,contact:{company:'SEBDA',owner:'Seba',email:'sebdafirma@gmail.com',phone:''}}
async function call<T>(path:string,init?:RequestInit):Promise<T>{
  if(import.meta.env.VITE_DEMO_MODE==='true') return demo as T
  const res=await fetch(`/api/${path}`,{...init,headers:{'content-type':'application/json',...init?.headers}})
  if(!res.ok) throw new Error((await res.json().catch(()=>({}))).error||'Nie udało się wykonać operacji')
  return res.json()
}
export const api={bootstrap:()=>call<Bootstrap>('bootstrap'),start:(selection?:{crewId:string;siteId:string})=>call<{shift:{id:string;startedAt:string;crewId?:string;siteId?:string}}>('shifts/start',{method:'POST',body:JSON.stringify(selection||{})}),stop:()=>call<{minutes:number;grossMinutes?:number;breakMinutes?:number}>('shifts/stop',{method:'POST'}),report:(data:Report)=>call<{id:string}>('reports',{method:'POST',body:JSON.stringify(data)}),admin:()=>call<AdminData>('admin'),summary:(from:string,to:string)=>call<Summary>(`admin/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),adminSave:(resource:AdminResource,data:Record<string,unknown>,id?:string)=>call<{row:{id:string}}>(`admin/${resource}${id?`/${id}`:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(data)})}
