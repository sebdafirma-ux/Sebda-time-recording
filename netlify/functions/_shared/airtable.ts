const base=()=>Netlify.env.get('AIRTABLE_BASE_ID')
const token=()=>Netlify.env.get('AIRTABLE_TOKEN')
export type RecordRow={id:string;fields:Record<string,unknown>;createdTime:string}
async function request(path:string,init?:RequestInit){if(!base()||!token())throw new Error('Brak konfiguracji Airtable');const res=await fetch(`https://api.airtable.com/v0/${base()}/${path}`,{...init,headers:{authorization:`Bearer ${token()}`,'content-type':'application/json',...init?.headers}});if(!res.ok){console.error('Airtable request failed',res.status,await res.text());throw new Error('Operacja Airtable nie powiodła się')}return res.json()}
export async function list(table:string,formula?:string){const rows:RecordRow[]=[];let offset='';do{const q=new URLSearchParams({pageSize:'100'});if(formula)q.set('filterByFormula',formula);if(offset)q.set('offset',offset);const page=await request(`${encodeURIComponent(table)}?${q}`);rows.push(...page.records);offset=String(page.offset||'')}while(offset);return rows}
export async function create(table:string,fields:Record<string,unknown>){return request(encodeURIComponent(table),{method:'POST',body:JSON.stringify({records:[{fields}],typecast:true})}).then(x=>x.records[0] as RecordRow)}
export async function update(table:string,id:string,fields:Record<string,unknown>){return request(encodeURIComponent(table),{method:'PATCH',body:JSON.stringify({records:[{id,fields}],typecast:true})}).then(x=>x.records[0] as RecordRow)}
export const esc=(value:string)=>value.replace(/['\\]/g,'\\$&')
