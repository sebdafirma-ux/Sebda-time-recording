const base=()=>Netlify.env.get('AIRTABLE_BASE_ID')
const token=()=>Netlify.env.get('AIRTABLE_TOKEN')
export type RecordRow={id:string;fields:Record<string,unknown>;createdTime:string}

type CacheEntry={expires:number;rows:RecordRow[]}
const CACHE_TTL_MS=60_000
const cache=new Map<string,CacheEntry>()
const pending=new Map<string,Promise<RecordRow[]>>()

async function request(path:string,init?:RequestInit){if(!base()||!token())throw new Error('Brak konfiguracji Airtable');const res=await fetch(`https://api.airtable.com/v0/${base()}/${path}`,{...init,headers:{authorization:`Bearer ${token()}`,'content-type':'application/json',...init?.headers}});if(!res.ok){console.error('Airtable request failed',res.status,await res.text());throw new Error('Operacja Airtable nie powiodła się')}return res.json()}

function invalidate(table:string){const prefix=`${table}\n`;for(const key of cache.keys())if(key.startsWith(prefix))cache.delete(key)}

async function load(table:string,formula?:string){const rows:RecordRow[]=[];let offset='';do{const q=new URLSearchParams({pageSize:'100'});if(formula)q.set('filterByFormula',formula);if(offset)q.set('offset',offset);const page=await request(`${encodeURIComponent(table)}?${q}`);rows.push(...page.records);offset=String(page.offset||'')}while(offset);return rows}

export async function list(table:string,formula?:string){const key=`${table}\n${formula||''}`,now=Date.now(),hit=cache.get(key);if(hit&&hit.expires>now)return hit.rows;const inFlight=pending.get(key);if(inFlight)return inFlight;const promise=load(table,formula).then(rows=>{cache.set(key,{expires:Date.now()+CACHE_TTL_MS,rows});return rows}).finally(()=>pending.delete(key));pending.set(key,promise);return promise}

export async function create(table:string,fields:Record<string,unknown>){const row=await request(encodeURIComponent(table),{method:'POST',body:JSON.stringify({records:[{fields}],typecast:true})}).then(x=>x.records[0] as RecordRow);invalidate(table);return row}
export async function update(table:string,id:string,fields:Record<string,unknown>){const row=await request(encodeURIComponent(table),{method:'PATCH',body:JSON.stringify({records:[{id,fields}],typecast:true})}).then(x=>x.records[0] as RecordRow);invalidate(table);return row}
export const esc=(value:string)=>value.replace(/['\\\\]/g,'\\\\$&')
