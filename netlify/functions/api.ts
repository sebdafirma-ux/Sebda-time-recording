import type{Config,Context}from'@netlify/functions'
import{admin as identityAdmin,getUser,verifyRequestOrigin}from'@netlify/identity'
import{create,esc,list,update,type RecordRow}from'./_shared/airtable'

type Role='admin'|'foreman'|'helper'
type Session={id:string;email:string;name:string;role:Role;crewId?:string;helperId?:string;helperCrewIds?:string[];hourlyRate?:number}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
const links=(r:RecordRow,key:string)=>Array.isArray(r.fields[key])?r.fields[key]as string[]:[]
const name=(r:RecordRow,key:string)=>String(r.fields[key]||'Bez nazwy')

async function session():Promise<Session|null>{
  const u=await getUser();if(!u)return null
  const raw=u as any,profile=raw.userMetadata||raw.user_metadata||{},app=raw.appMetadata||raw.app_metadata||{},email=String(raw.email||'').toLowerCase();if(!email||app.blocked===true)return null
  const base={id:raw.id,email,name:profile.full_name||raw.name||email} as Session
  const adminEmail=String(Netlify.env.get('ADMIN_EMAIL')||'').toLowerCase()
  if(adminEmail&&email===adminEmail)return{...base,role:'admin'}
  const[crews,helpers]=await Promise.all([list('Brygady'),list('Pomocnicy')])
  const crew=crews.find(x=>String(x.fields['E-mail brygadzisty']||'').toLowerCase()===email)
  if(crew)return{...base,role:'foreman',crewId:crew.id}
  const helper=helpers.find(x=>String(x.fields['E-mail logowania']||'').toLowerCase()===email)
  if(helper)return{...base,name:name(helper,'Imię i nazwisko'),role:'helper',helperId:helper.id,helperCrewIds:links(helper,'Brygady'),hourlyRate:Number(helper.fields['Stawka godzinowa']||0)}
  return null
}

async function bootstrap(s:Session){
  const[sites,buildings,crews]=await Promise.all([list('Budowy'),list('Budynki'),list('Brygady')])
  let allowedCrews=crews,allowedSites=sites,allowedBuildings=buildings,shiftRows:RecordRow[]=[]
  if(s.role==='foreman'){
    allowedCrews=crews.filter(x=>x.id===s.crewId);const siteIds=new Set(allowedCrews.flatMap(x=>links(x,'Powiązane budowy')))
    allowedSites=sites.filter(x=>siteIds.has(x.id));allowedBuildings=buildings.filter(x=>links(x,'Powiązana budowa').some(id=>siteIds.has(id)))
    shiftRows=await list(Netlify.env.get('AIRTABLE_TIME_TABLE')||'Ewidencja czasu pracy',`AND({Data}=TODAY(),{Brygadzista}='${esc(s.email)}')`)
  }else if(s.role==='helper'){
    const allowed=new Set(s.helperCrewIds||[]);allowedCrews=crews.filter(x=>allowed.has(x.id));const siteIds=new Set(allowedCrews.flatMap(x=>links(x,'Powiązane budowy')))
    allowedSites=sites.filter(x=>siteIds.has(x.id));allowedBuildings=[]
    shiftRows=await list('Ewidencja pomocników',`AND({Data}=TODAY(),{E-mail}='${esc(s.email)}')`)
  }else shiftRows=await list(Netlify.env.get('AIRTABLE_TIME_TABLE')||'Ewidencja czasu pracy',`AND({Data}=TODAY(),{Brygadzista}='${esc(s.email)}')`)
  const active=shiftRows.find(x=>x.fields.Status==='W toku'),minuteField=s.role==='helper'?'Minuty płatne':'Minuty'
  const finished=shiftRows.filter(x=>x.fields.Status==='Zakończony').reduce((n,x)=>n+Number(x.fields[minuteField]||0),0)
  return{user:{name:s.name,role:s.role,crewId:s.crewId},sites:allowedSites.map(x=>({id:x.id,name:name(x,'Nazwa budowy')})),buildings:allowedBuildings.map(x=>({id:x.id,name:name(x,'Nazwa / numer budynku'),parentId:links(x,'Powiązana budowa')[0]})),crews:allowedCrews.map(x=>({id:x.id,name:name(x,'Nazwa brygady')})),crewSites:Object.fromEntries(allowedCrews.map(x=>[x.id,links(x,'Powiązane budowy')])),activeShift:active?{id:active.id,startedAt:String(active.fields.Start),crewId:links(active,'Brygada')[0],siteId:links(active,'Budowa')[0]}:undefined,todayMinutes:finished,contact:{company:'SEBDA',owner:'',email:adminEmail(),phone:Netlify.env.get('CONTACT_PHONE')||'790 495 208'}}
}
const adminEmail=()=>String(Netlify.env.get('ADMIN_EMAIL')||'sebdafirma@gmail.com')

async function start(s:Session,req:Request){
  if(s.role==='helper')return helperStart(s,req)
  const table=Netlify.env.get('AIRTABLE_TIME_TABLE')||'Ewidencja czasu pracy',today=new Date().toISOString().slice(0,10)
  const existing=await list(table,`AND({Data}=TODAY(),{Brygadzista}='${esc(s.email)}',{Status}='W toku')`);if(existing[0])return json({shift:{id:existing[0].id,startedAt:existing[0].fields.Start}})
  const now=new Date().toISOString(),r=await create(table,{Dzień:`${today} — ${s.name}`,Data:today,...(s.crewId?{Brygada:[s.crewId]}:{}),Brygadzista:s.email,Start:now,Status:'W toku'})
  return json({shift:{id:r.id,startedAt:now}},201)
}
async function stop(s:Session){
  if(s.role==='helper')return helperStop(s)
  const table=Netlify.env.get('AIRTABLE_TIME_TABLE')||'Ewidencja czasu pracy',rows=await list(table,`AND({Data}=TODAY(),{Brygadzista}='${esc(s.email)}',{Status}='W toku')`)
  if(!rows[0])return json({error:'Brak rozpoczętego dnia pracy'},409)
  const end=new Date(),minutes=Math.max(1,Math.round((end.getTime()-new Date(String(rows[0].fields.Start)).getTime())/60000))
  await update(table,rows[0].id,{Koniec:end.toISOString(),Minuty:minutes,Status:'Zakończony'});return json({minutes})
}
async function helperStart(s:Session,req:Request){
  const b=await req.json()as Record<string,unknown>,crewId=String(b.crewId||''),siteId=String(b.siteId||'')
  if(!crewId||!siteId)return json({error:'Wybierz brygadę i budowę'},400)
  if(!s.helperCrewIds?.includes(crewId))return json({error:'Nie jesteś przypisany do tej brygady'},403)
  const crew=(await list('Brygady',`RECORD_ID()='${esc(crewId)}'`))[0];if(!crew||!links(crew,'Powiązane budowy').includes(siteId))return json({error:'Ta budowa nie jest przypisana do wybranej brygady'},403)
  const existing=await list('Ewidencja pomocników',`AND({Data}=TODAY(),{E-mail}='${esc(s.email)}',{Status}='W toku')`);if(existing[0])return json({shift:{id:existing[0].id,startedAt:existing[0].fields.Start,crewId,siteId}})
  if(!s.helperId)return json({error:'Konto pomocnika nie ma prawidłowego przypisania'},403)
  const now=new Date().toISOString(),today=now.slice(0,10),r=await create('Ewidencja pomocników',{Dzień:`${today} — ${s.name}`,Data:today,Pomocnik:[s.helperId],'E-mail':s.email,Brygada:[crewId],Budowa:[siteId],Start:now,'Stawka godzinowa':s.hourlyRate||0,Status:'W toku'})
  return json({shift:{id:r.id,startedAt:now,crewId,siteId}},201)
}
async function helperStop(s:Session){
  const rows=await list('Ewidencja pomocników',`AND({Data}=TODAY(),{E-mail}='${esc(s.email)}',{Status}='W toku')`);if(!rows[0])return json({error:'Brak rozpoczętej pracy'},409)
  const end=new Date(),gross=Math.max(1,Math.round((end.getTime()-new Date(String(rows[0].fields.Start)).getTime())/60000)),paid=Math.max(0,gross-30),rate=Number(rows[0].fields['Stawka godzinowa']||s.hourlyRate||0),amount=Math.round(paid/60*rate*100)/100
  await update('Ewidencja pomocników',rows[0].id,{Koniec:end.toISOString(),'Minuty brutto':gross,'Przerwa min':30,'Minuty płatne':paid,Kwota:amount,Status:'Zakończony'});return json({minutes:paid,grossMinutes:gross,breakMinutes:30})
}

async function report(req:Request,s:Session){
  if(s.role==='helper')return json({error:'Raporty m² dodaje brygadzista lub administrator'},403)
  if(s.role==='foreman'){const active=await list(Netlify.env.get('AIRTABLE_TIME_TABLE')||'Ewidencja czasu pracy',`AND({Data}=TODAY(),{Brygadzista}='${esc(s.email)}',{Status}='W toku')`);if(!active[0])return json({error:'Najpierw rozpocznij dzień pracy'},409)}
  const b=await req.json()as Record<string,unknown>,meters=Number(b.squareMeters),people=Number(b.people)
  if(!b.siteId||!b.buildingId||!Number.isFinite(meters)||meters<=0||!Number.isInteger(people)||people<1)return json({error:'Uzupełnij poprawnie wymagane pola'},400)
  const crewId=s.role==='foreman'?s.crewId:String(b.crewId||'');if(!crewId)return json({error:'Brak brygady'},400)
  const[crew,building]=await Promise.all([list('Brygady',`RECORD_ID()='${esc(crewId)}'`),list('Budynki',`RECORD_ID()='${esc(String(b.buildingId))}'`)])
  if(!crew[0]||!building[0]||(s.role==='foreman'&&crewId!==s.crewId))return json({error:'Brak dostępu do tej brygady lub budynku'},403)
  if(!links(crew[0],'Powiązane budowy').includes(String(b.siteId))||!links(building[0],'Powiązana budowa').includes(String(b.siteId)))return json({error:'Budowa nie jest przypisana do tej brygady lub budynku'},403)
  const today=new Date().toISOString().slice(0,10),site=(await list('Budowy',`RECORD_ID()='${esc(String(b.siteId))}'`))[0]
  const r=await create('Postęp robót',{Raport:`${today} — ${name(crew[0],'Nazwa brygady')}`,Data:today,Budowa:name(site,'Nazwa budowy'),'Budynek / etap':name(building[0],'Nazwa / numer budynku'),'Kondygnacja / strefa':String(b.zone||''),'Wykonano m²':meters,'Liczba osób':people,Uwagi:String(b.notes||''),'Powiązana budowa':[b.siteId],Brygada:[crewId],Budynek:[b.buildingId]})
  if(b.problem)await create('Problemy i dokumentacja',{Temat:`Zgłoszenie ${today}`,'Data zgłoszenia':today,Opis:String(b.problem),'Powiązana budowa':[b.siteId],Brygada:[crewId],Budynek:[b.buildingId]});return json({id:r.id},201)
}

type Resource='crews'|'helpers'|'sites'|'buildings'|'reports'|'problems'|'shifts'|'helperShifts'|'invoices'|'costs'
const resources:Record<Resource,{table:string;fields:Record<string,string>;required:string}>={
  crews:{table:'Brygady',required:'name',fields:{name:'Nazwa brygady',foreman:'Brygadzista',email:'E-mail brygadzisty',phone:'Telefon',people:'Liczba osób',rate:'Stawka domyślna zł/m²',status:'Status',notes:'Uwagi',siteIds:'Powiązane budowy'}},
  helpers:{table:'Pomocnicy',required:'name',fields:{name:'Imię i nazwisko',email:'E-mail logowania',phone:'Telefon',hourlyRate:'Stawka godzinowa',status:'Status',crewIds:'Brygady',notes:'Uwagi'}},
  sites:{table:'Budowy',required:'name',fields:{name:'Nazwa budowy',client:'Klient / Generalny wykonawca',location:'Lokalizacja',status:'Status',start:'Data rozpoczęcia',end:'Termin zakończenia',area:'Powierzchnia umowna m²',rate:'Stawka zł/m²',notes:'Uwagi'}},
  buildings:{table:'Budynki',required:'name',fields:{name:'Nazwa / numer budynku',description:'Typ / opis',status:'Status',area:'Powierzchnia tynków m²',start:'Termin startu',end:'Termin zakończenia',notes:'Uwagi',siteIds:'Powiązana budowa'}},
  reports:{table:'Postęp robót',required:'name',fields:{name:'Raport',date:'Data',site:'Budowa',building:'Budynek / etap',zone:'Kondygnacja / strefa',meters:'Wykonano m²',people:'Liczba osób',notes:'Uwagi',siteIds:'Powiązana budowa',crewIds:'Brygada',buildingIds:'Budynek'}},
  problems:{table:'Problemy i dokumentacja',required:'title',fields:{title:'Temat',date:'Data zgłoszenia',type:'Typ',priority:'Priorytet',status:'Status',responsible:'Odpowiedzialny / adresat',deadline:'Termin działania',description:'Opis',resolution:'Ustalenia / odpowiedź',siteIds:'Powiązana budowa',crewIds:'Brygada',buildingIds:'Budynek'}},
  shifts:{table:'Ewidencja czasu pracy',required:'day',fields:{day:'Dzień',date:'Data',email:'Brygadzista',start:'Start',end:'Koniec',minutes:'Minuty',status:'Status',crewIds:'Brygada'}},
  helperShifts:{table:'Ewidencja pomocników',required:'day',fields:{day:'Dzień',date:'Data',helperIds:'Pomocnik',email:'E-mail',crewIds:'Brygada',siteIds:'Budowa',start:'Start',end:'Koniec',grossMinutes:'Minuty brutto',breakMinutes:'Przerwa min',paidMinutes:'Minuty płatne',hourlyRate:'Stawka godzinowa',amount:'Kwota',status:'Status',notes:'Uwagi'}},
  invoices:{table:'Faktury',required:'number',fields:{number:'Numer faktury',contractor:'Kontrahent',issued:'Data wystawienia',due:'Termin płatności',net:'Kwota netto',vat:'VAT',gross:'Kwota brutto',status:'Status płatności',paid:'Data zapłaty',notes:'Uwagi',siteIds:'Powiązana budowa'}},
  costs:{table:'Koszty',required:'description',fields:{description:'Opis kosztu',date:'Data',category:'Kategoria',supplier:'Dostawca',net:'Kwota netto',gross:'Kwota brutto',paid:'Zapłacono',due:'Termin płatności',notes:'Uwagi',siteIds:'Powiązana budowa'}}
}
function adminRow(r:RecordRow,c:{fields:Record<string,string>}){const out:Record<string,unknown>={id:r.id};for(const[k,v]of Object.entries(c.fields))out[k]=r.fields[v];return out}
function adminFields(body:Record<string,unknown>,c:{fields:Record<string,string>}){const out:Record<string,unknown>={};for(const[k,v]of Object.entries(c.fields))if(Object.prototype.hasOwnProperty.call(body,k))out[v]=body[k];return out}
async function adminList(s:Session){if(s.role!=='admin')return json({error:'Brak uprawnień administratora'},403);const entries=Object.entries(resources)as[Resource,(typeof resources)[Resource]][];const values=await Promise.all(entries.map(async([key,c])=>[key,(await list(c.table)).map(r=>adminRow(r,c))]));return json(Object.fromEntries(values))}
async function findIdentity(email:string){let page=1;while(page<=20){const users=await identityAdmin.listUsers({page,perPage:100});const found=users.find(x=>String(x.email||'').toLowerCase()===email.toLowerCase());if(found)return found;if(users.length<100)return;page++}}
async function adminSave(req:Request,s:Session,resource:string,id?:string){if(s.role!=='admin')return json({error:'Brak uprawnień administratora'},403);const c=resources[resource as Resource];if(!c)return json({error:'Nieprawidłowy moduł'},404);const body=await req.json()as Record<string,unknown>,fields=adminFields(body,c);if(!id&&!String(body[c.required]||'').trim())return json({error:'Uzupełnij wymagane pole'},400);const managesAccount=resource==='crews'||resource==='helpers',email=String(body.email||'').trim().toLowerCase(),password=String(body.password||''),role=resource==='helpers'?'helper':'foreman',displayName=String(body.name||body.foreman||email);let createdUserId='';if(managesAccount){if(!email)return json({error:'Podaj e-mail będący loginem'},400);if(!id&&password.length<10)return json({error:'Hasło początkowe musi mieć co najmniej 10 znaków'},400);const previous=id?(await list(c.table,`RECORD_ID()='${esc(id)}'`))[0]:undefined,previousEmail=String(previous?.fields[c.fields.email]||email),existing=await findIdentity(previousEmail);if(!id&&existing)return json({error:'Konto z tym loginem już istnieje'},409);if(id&&!existing){if(password.length<10)return json({error:'Konto nie istnieje. Podaj hasło początkowe (minimum 10 znaków), aby je utworzyć.'},400);const user=await identityAdmin.createUser({email,password,data:{app_metadata:{roles:[role],blocked:false},user_metadata:{full_name:displayName}}});createdUserId=user.id}if(id&&existing&&(password||email!==previousEmail.toLowerCase())){if(password&&password.length<10)return json({error:'Nowe hasło musi mieć co najmniej 10 znaków'},400);await identityAdmin.updateUser(existing.id,{...(password?{password}:{}),...(email!==previousEmail.toLowerCase()?{email}:{}),user_metadata:{...(existing.userMetadata||{}),full_name:displayName}})}if(!id){const user=await identityAdmin.createUser({email,password,data:{app_metadata:{roles:[role],blocked:false},user_metadata:{full_name:displayName}}});createdUserId=user.id}}
  try{const row=id?await update(c.table,id,fields):await create(c.table,fields);return json({row:{id:row.id}},id?200:201)}catch(e){if(createdUserId)await identityAdmin.deleteUser(createdUserId).catch(()=>{});throw e}}
async function adminAccounts(req:Request,s:Session){if(s.role!=='admin')return json({error:'Brak uprawnień administratora'},403);const users=await identityAdmin.listUsers({page:1,perPage:100});return json({accounts:users.map(u=>({id:u.id,email:u.email||'',name:u.name||u.userMetadata?.full_name||'',role:u.roles?.[0]||u.appMetadata?.roles?.[0]||u.role||'pracownik',blocked:u.appMetadata?.blocked===true,lastSignInAt:u.lastSignInAt||'',createdAt:u.createdAt||''})).filter(x=>x.email.toLowerCase()!==adminEmail().toLowerCase())})}
async function adminAccountUpdate(req:Request,s:Session,userId:string){if(s.role!=='admin')return json({error:'Brak uprawnień administratora'},403);const body=await req.json()as Record<string,unknown>,user=await identityAdmin.getUser(userId);if(String(user.email||'').toLowerCase()===adminEmail().toLowerCase())return json({error:'Nie można zmieniać głównego konta administratora'},403);const changes:Record<string,unknown>={};if(typeof body.blocked==='boolean')changes.app_metadata={...(user.appMetadata||{}),blocked:body.blocked};if(body.password){const password=String(body.password);if(password.length<10)return json({error:'Hasło musi mieć co najmniej 10 znaków'},400);changes.password=password}if(!Object.keys(changes).length)return json({error:'Brak zmian do zapisania'},400);await identityAdmin.updateUser(userId,changes);return json({ok:true})}
async function summary(req:Request,s:Session){if(s.role!=='admin')return json({error:'Brak uprawnień administratora'},403);const u=new URL(req.url),from=u.searchParams.get('from')||new Date().toISOString().slice(0,10),to=u.searchParams.get('to')||from;const within=(r:RecordRow,key:string)=>{const d=String(r.fields[key]||'').slice(0,10);return d>=from&&d<=to};const[shifts,helperShifts,reports,problems,crews,helpers,sites]=await Promise.all([list('Ewidencja czasu pracy'),list('Ewidencja pomocników'),list('Postęp robót'),list('Problemy i dokumentacja'),list('Brygady'),list('Pomocnicy'),list('Budowy')]);const selectedShifts=shifts.filter(x=>within(x,'Data')),selectedHelpers=helperShifts.filter(x=>within(x,'Data')),selectedReports=reports.filter(x=>within(x,'Data')),selectedProblems=problems.filter(x=>within(x,'Data zgłoszenia'));const crewName=(ids:string[])=>ids.map(id=>name(crews.find(x=>x.id===id)||{id:'',fields:{},createdTime:''},'Nazwa brygady')).join(', '),helperName=(ids:string[])=>ids.map(id=>name(helpers.find(x=>x.id===id)||{id:'',fields:{},createdTime:''},'Imię i nazwisko')).join(', '),siteName=(ids:string[])=>ids.map(id=>name(sites.find(x=>x.id===id)||{id:'',fields:{},createdTime:''},'Nazwa budowy')).join(', ');return json({from,to,totals:{foremanHours:selectedShifts.reduce((n,x)=>n+Number(x.fields.Minuty||0),0)/60,helperHours:selectedHelpers.reduce((n,x)=>n+Number(x.fields['Minuty płatne']||0),0)/60,helperCost:selectedHelpers.reduce((n,x)=>n+Number(x.fields.Kwota||0),0),meters:selectedReports.reduce((n,x)=>n+Number(x.fields['Wykonano m²']||0),0),problems:selectedProblems.length},rows:[...selectedShifts.map(x=>({date:x.fields.Data,type:'Brygadzista',person:x.fields.Brygadzista,crew:crewName(links(x,'Brygada')),site:'',hours:Number(x.fields.Minuty||0)/60,meters:0,cost:0})),...selectedHelpers.map(x=>({date:x.fields.Data,type:'Pomocnik',person:helperName(links(x,'Pomocnik'))||x.fields['E-mail'],crew:crewName(links(x,'Brygada')),site:siteName(links(x,'Budowa')),hours:Number(x.fields['Minuty płatne']||0)/60,meters:0,cost:Number(x.fields.Kwota||0)})),...selectedReports.map(x=>({date:x.fields.Data,type:'Raport m²',person:'',crew:crewName(links(x,'Brygada')),site:x.fields.Budowa,hours:0,meters:Number(x.fields['Wykonano m²']||0),cost:Number(x.fields['Wartość robót brygady']||0)}))]})}

export default async(req:Request,context:Context)=>{try{const s=await session();if(!s)return json({error:'Konto jest zablokowane albo nieprzypisane do administratora, brygadzisty ani pomocnika'},401);const path=new URL(req.url).pathname;if(req.method!=='GET')verifyRequestOrigin(req);if(req.method==='GET'&&path==='/api/bootstrap')return json(await bootstrap(s));if(req.method==='POST'&&path==='/api/shifts/start')return start(s,req);if(req.method==='POST'&&path==='/api/shifts/stop')return stop(s);if(req.method==='POST'&&path==='/api/reports')return report(req,s);if(req.method==='GET'&&path==='/api/admin')return adminList(s);if(req.method==='GET'&&path==='/api/admin/summary')return summary(req,s);if(req.method==='GET'&&path==='/api/admin/accounts')return adminAccounts(req,s);const account=path.match(/^\/api\/admin\/accounts\/([^/]+)$/);if(account&&req.method==='PATCH')return adminAccountUpdate(req,s,account[1]);const match=path.match(/^\/api\/admin\/([A-Za-z]+)(?:\/([^/]+))?$/);if(match&&(req.method==='POST'||req.method==='PATCH'))return adminSave(req,s,match[1],match[2]);return json({error:'Nie znaleziono'},404)}catch(e){console.error('API error',context.requestId,e);return json({error:'Nie udało się wykonać operacji. Spróbuj ponownie.'},500)}}
export const config:Config={path:'/api/*'}
