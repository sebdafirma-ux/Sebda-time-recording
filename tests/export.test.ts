import {beforeEach,describe,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({list:vi.fn()}))
vi.mock('../netlify/functions/_shared/airtable',()=>({list:mocks.list}))
import {exportReport,validReportDates} from '../netlify/functions/_shared/report-export'
import {periodDates} from '../src/report-periods'
const row=(id:string,fields:Record<string,unknown>)=>({id,fields,createdTime:''})
const report=(id:string,crew:string,site:string,building:string,meters:number,date='2026-09-30')=>row(id,{Data:date,Brygada:[crew],'Powiązana budowa':[site],Budynek:[building],'Wykonano m²':meters,'Stawka brygady zł/m²':20})
beforeEach(()=>{
 const data:Record<string,ReturnType<typeof row>[]>={
  'Postęp robót':[report('r1','c1','s1','b1',10),report('r2','c1','s1','b2',20),report('r3','c2','s1','b1',50),report('r4','c1','s2','b3',40),report('r5','c1','s1','b1',100,'2026-08-01')],
  Budowy:[row('s1',{'Nazwa budowy':'Budowa A'}),row('s2',{'Nazwa budowy':'Budowa B'})],
  Budynki:[row('b1',{'Nazwa / numer budynku':'Budynek 1'}),row('b2',{'Nazwa / numer budynku':'Budynek 2'}),row('b3',{'Nazwa / numer budynku':'Budynek 3'})],
  Brygady:[row('c1',{'Nazwa brygady':'Pierwsza'}),row('c2',{'Nazwa brygady':'Druga'})],
  'Ewidencja pomocników':[row('h1',{Data:'2026-09-30','E-mail':'helper@test',Budowa:['s1'],Brygada:['c1'],'Minuty płatne':120,'Stawka godzinowa':30,Kwota:60}),row('h2',{Data:'2026-09-30','E-mail':'someone@test',Budowa:['s2'],Brygada:['c2'],'Minuty płatne':600,Kwota:500})]
 }
 mocks.list.mockReset().mockImplementation(async name=>data[name]||[])
})
const foreman={role:'foreman' as const,name:'Pierwszy',email:'foreman@test',crewId:'c1'}
const admin={role:'admin' as const,name:'Admin',email:'admin@test'}
describe('export scope and totals',()=>{
 it('includes all crews for an administrator without a crew filter',async()=>{const r=await exportReport(admin,'2026-09-01','2026-09-30');expect(r.rows).toHaveLength(4);expect(r.totals.meters).toBe(120);expect(r.totals.earnings).toBe(2400)})
 it('filters admin reports by crew and site',async()=>{const r=await exportReport(admin,'2026-09-01','2026-09-30','c1','s1');expect(r.rows.map(x=>x.id)).toEqual(['r1','r2']);expect(r.totals.meters).toBe(30)})
 it('foreman cannot request another crew via a forged crew parameter',async()=>{const r=await exportReport(foreman,'2026-09-01','2026-09-30','c2');expect(r.rows.every(x=>x.crewId==='c1')).toBe(true);expect(r.totals.meters).toBe(70)})
 it('includes building identities and distinct building names',async()=>{const r=await exportReport(foreman,'2026-09-30','2026-09-30','','s1');expect(r.rows.map(x=>x.building)).toEqual(['Budynek 1','Budynek 2']);expect(r.totals.earnings).toBe(600)})
 it('allows historical sites and periods without relying on crew assignment',async()=>{const r=await exportReport(foreman,'2026-08-01','2026-08-01','','s1');expect(r.totals.meters).toBe(100)})
 it('returns an empty report with zero totals when no records match',async()=>{const r=await exportReport(admin,'2025-01-01','2025-01-02');expect(r.rows).toEqual([]);expect(r.totals).toEqual({meters:0,hours:0,earnings:0})})
 it('never exposes a different helpers hours or crew m2',async()=>{const r=await exportReport({role:'helper',name:'Pomocnik',email:'helper@test'},'2026-09-01','2026-09-30','c2');expect(r.rows.map(x=>x.id)).toEqual(['h1']);expect(r.kind).toBe('hours');expect(r.totals).toEqual({hours:2,meters:0,earnings:60});expect(r.sites.map(x=>x.id)).toEqual(['s1'])})
 it('fails closed for a foreman without an assigned crew',async()=>{const r=await exportReport({...foreman,crewId:undefined},'2026-09-01','2026-09-30');expect(r.rows).toEqual([])})
})
describe('report periods',()=>{
 it('uses the Warsaw day near UTC midnight',()=>{expect(periodDates('day',new Date('2026-09-30T22:30:00Z'))).toEqual({from:'2026-10-01',to:'2026-10-01'})})
 it('uses the full Monday to Sunday week',()=>{expect(periodDates('week',new Date('2026-09-30T12:00:00Z'))).toEqual({from:'2026-09-28',to:'2026-10-04'})})
 it('handles leap year months',()=>{expect(periodDates('month',new Date('2028-02-29T12:00:00Z'))).toEqual({from:'2028-02-01',to:'2028-02-29'})})
 it('rejects malformed, impossible and reversed dates',()=>{expect(validReportDates('2026-09-01','2026-09-30')).toBe(true);for(const [a,b] of [['2026-09-30','2026-09-01'],['2026-02-30','2026-03-01'],['bad','2026-09-01']])expect(validReportDates(a,b)).toBe(false)})
})
