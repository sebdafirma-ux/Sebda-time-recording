import {list,type RecordRow} from './airtable'
import type {ExportReport,ExportRow,Role} from '../../../src/types'

type Viewer={role:Role;name:string;email:string;crewId?:string}
const links=(r:RecordRow,key:string)=>Array.isArray(r.fields[key])?r.fields[key] as string[]:[]
const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0
export const warsawDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(new Date())
export function validReportDates(from:string,to:string){
 const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
 return valid(from)&&valid(to)&&from<=to
}
export async function exportReport(viewer:Viewer,from:string,to:string,crewFilter='',siteFilter=''):Promise<ExportReport>{
 const [reports,sites,buildings,crews,helperShifts]=await Promise.all([
  viewer.role==='helper'?Promise.resolve([]):list('Postęp robót'),list('Budowy'),list('Budynki'),list('Brygady'),
  viewer.role==='helper'?list('Ewidencja pomocników'):Promise.resolve([])
 ])
 const nameOf=(rows:RecordRow[],id:string,key:string,fallback:string)=>String(rows.find(x=>x.id===id)?.fields[key]||fallback)
 const allowedCrew=viewer.role==='admin'?crewFilter:viewer.crewId
 const scoped=viewer.role==='helper'
  ?helperShifts.filter(r=>String(r.fields['E-mail']||'').toLowerCase()===viewer.email)
  :reports.filter(r=>viewer.role==='admin'?!allowedCrew||links(r,'Brygada').includes(allowedCrew):Boolean(allowedCrew)&&links(r,'Brygada').includes(allowedCrew!))
 const helper=viewer.role==='helper'
 const allRows:ExportRow[]=scoped.map(r=>{
  const siteId=links(r,helper?'Budowa':'Powiązana budowa')[0]||sites.find(s=>s.fields['Nazwa budowy']===r.fields.Budowa)?.id||''
  const buildingId=links(r,'Budynek')[0]||'',crewId=links(r,'Brygada')[0]||''
  const meters=helper?0:number(r.fields['Wykonano m²']),rate=number(r.fields[helper?'Stawka godzinowa':'Stawka brygady zł/m²'])
  return {id:r.id,date:String(r.fields.Data||'').slice(0,10),crewId,crew:nameOf(crews,crewId,'Nazwa brygady','Bez wskazanej brygady'),siteId,
   site:nameOf(sites,siteId,'Nazwa budowy',helper?'Bez wskazanej budowy':String(r.fields.Budowa||'Bez wskazanej budowy')),
   buildingId,building:helper?'Nie dotyczy':String(r.fields['Budynek / etap']||nameOf(buildings,buildingId,'Nazwa / numer budynku','Bez wskazanego budynku')),
   zone:String(r.fields['Kondygnacja / strefa']||''),meters,hours:helper?number(r.fields['Minuty płatne'])/60:0,rate,
   earnings:helper?number(r.fields.Kwota):r.fields['Wartość robót brygady']===undefined?meters*rate:number(r.fields['Wartość robót brygady']),notes:String(r.fields.Uwagi||'')}
 })
 const rows=allRows.filter(r=>r.date>=from&&r.date<=to&&(!siteFilter||r.siteId===siteFilter)).sort((a,b)=>a.date.localeCompare(b.date)||a.crew.localeCompare(b.crew,'pl')||a.site.localeCompare(b.site,'pl')||a.building.localeCompare(b.building,'pl'))
 const visibleSiteIds=new Set(allRows.map(r=>r.siteId))
 const siteOptions=sites.filter(s=>!helper||visibleSiteIds.has(s.id)).map(s=>({id:s.id,name:String(s.fields['Nazwa budowy']||'Bez nazwy')})).sort((a,b)=>a.name.localeCompare(b.name,'pl'))
 return {from,to,title:helper?`Raport pomocnika: ${viewer.name}`:viewer.role==='admin'&&!crewFilter?'Wszystkie brygady':`Brygada: ${nameOf(crews,allowedCrew||'','Nazwa brygady',viewer.name)}`,
  kind:helper?'hours':'meters',site:siteFilter?nameOf(sites,siteFilter,'Nazwa budowy','Wybrana budowa'):'Wszystkie budowy',sites:siteOptions,rows,
  totals:{meters:rows.reduce((n,r)=>n+r.meters,0),hours:rows.reduce((n,r)=>n+r.hours,0),earnings:rows.reduce((n,r)=>n+r.earnings,0)}}
}
