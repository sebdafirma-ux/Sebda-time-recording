import {beforeEach,describe,expect,it,vi} from 'vitest'
import type {Context} from '@netlify/functions'
const mocks=vi.hoisted(()=>({getUser:vi.fn(),list:vi.fn(),create:vi.fn(),update:vi.fn()}))
vi.mock('@netlify/identity',()=>({getUser:mocks.getUser,verifyRequestOrigin:vi.fn(),admin:{}}))
vi.mock('../netlify/functions/_shared/airtable',()=>({...mocks,esc:(x:string)=>x}))
import handler from '../netlify/functions/api'
const row=(id:string,fields:Record<string,unknown>)=>({id,fields,createdTime:''})
let tables:Record<string,ReturnType<typeof row>[]>
const request=(path:string,method='GET',body?:unknown)=>handler(new Request('https://example.test/api/'+path,{method,...(body?{body:JSON.stringify(body)}:{})}),{} as Context)
const report={siteId:'new',buildingId:'new-building',squareMeters:12.5,people:2,notes:'test'}
beforeEach(()=>{
 vi.clearAllMocks()
 vi.stubGlobal('Netlify',{env:{get:(key:string)=>key==='ADMIN_EMAIL'?'admin@example.test':undefined}})
 mocks.getUser.mockResolvedValue({id:'user',email:'foreman@example.test'})
 tables={Brygady:[row('mine',{'E-mail brygadzisty':'foreman@example.test','Nazwa brygady':'Mine','Powiązane budowy':['old'],'Stawka domyślna zł/m²':25}),row('other',{'Nazwa brygady':'Other'})],Pomocnicy:[row('helper',{'E-mail logowania':'helper@example.test'})],Budowy:[row('old',{'Nazwa budowy':'Old',Status:'W trakcie'}),row('new',{'Nazwa budowy':'New'}),row('planned',{Status:'Planowana'}),row('paused',{Status:'Wstrzymana'}),row('closed',{Status:'Zakończona'}),row('paid',{Status:'Rozliczona'})],Budynki:[row('new-building',{'Nazwa / numer budynku':'B1','Powiązana budowa':['new']}),row('old-building',{'Powiązana budowa':['old']}),row('closed-building',{'Powiązana budowa':['closed']})]}
 mocks.list.mockImplementation(async(table:string,formula?:string)=>{const rows=tables[table]||[];const id=formula?.match(/^RECORD_ID\(\)='([^']+)'$/)?.[1];return id?rows.filter(r=>r.id===id):rows})
 mocks.create.mockResolvedValue(row('saved',{}));mocks.update.mockResolvedValue(row('saved',{}))
})
describe('report access through the API',()=>{
 it('bootstraps every available site and its buildings, with only the own crew',async()=>{
 const result=await (await request('bootstrap')).json()
 expect(result.sites.map((x:any)=>x.id)).toEqual(['old','new','planned'])
 expect(result.buildings.map((x:any)=>x.id)).toEqual(['new-building','old-building'])
 expect(result.crews.map((x:any)=>x.id)).toEqual(['mine'])
 })
 it('saves to an unassigned site without starting a shift, using own crew and server rate',async()=>{
 const response=await request('reports','POST',{...report,crewId:'other',crewRate:999})
 expect(response.status).toBe(201)
 expect(mocks.create).toHaveBeenCalledWith('Postęp robót',expect.objectContaining({'Wykonano m²':12.5,Brygada:['mine'],'Powiązana budowa':['new'],Budynek:['new-building'],'Stawka brygady zł/m²':25,'Liczba osób':2}))
 expect(mocks.list.mock.calls.some(([table])=>table==='Ewidencja czasu pracy')).toBe(false)
 })
 it('does not edit a report even if its id is supplied when creating',async()=>{
 expect((await request('reports','POST',{...report,id:'existing'})).status).toBe(201)
 expect(mocks.update).not.toHaveBeenCalled()
 })
 it.each(['paused','closed','paid','missing'])('rejects unavailable or missing site %s',async siteId=>{
 tables.Budynki[0].fields['Powiązana budowa']=[siteId]
 expect((await request('reports','POST',{...report,siteId})).status).toBe(403)
 expect(mocks.create).not.toHaveBeenCalled()
 })
 it('rejects a building from another site',async()=>{
 expect((await request('reports','POST',{...report,buildingId:'old-building'})).status).toBe(403)
 expect(mocks.create).not.toHaveBeenCalled()
 })
 it('rejects missing buildings',async()=>{
 expect((await request('reports','POST',{...report,buildingId:'missing'})).status).toBe(403)
 expect(mocks.create).not.toHaveBeenCalled()
 })
 it.each([0,-1,'invalid'])('rejects invalid area %s',async squareMeters=>{
 expect((await request('reports','POST',{...report,squareMeters})).status).toBe(400)
 expect(mocks.create).not.toHaveBeenCalled()
 })
 it('rejects foreman report edits through administrator route',async()=>{
 expect((await request('admin/reports/saved','PATCH',{meters:10})).status).toBe(403)
 expect(mocks.update).not.toHaveBeenCalled()
 })
 it('has no public report update route',async()=>{
 expect((await request('reports/saved','PATCH',{meters:10})).status).toBe(404)
 expect(mocks.update).not.toHaveBeenCalled()
 })
 it('allows administrator to correct a saved report',async()=>{
 mocks.getUser.mockResolvedValue({id:'admin',email:'admin@example.test'})
 expect((await request('admin/reports/saved','PATCH',{meters:10})).status).toBe(200)
 expect(mocks.update).toHaveBeenCalledWith('Postęp robót','saved',{'Wykonano m²':10})
 })
 it('rejects helper report creation',async()=>{
 mocks.getUser.mockResolvedValue({id:'helper',email:'helper@example.test'})
 expect((await request('reports','POST',report)).status).toBe(403)
 expect(mocks.create).not.toHaveBeenCalled()
 })
 it('rejects unauthenticated requests',async()=>{
 mocks.getUser.mockResolvedValue(null)
 expect((await request('reports','POST',report)).status).toBe(401)
 expect(mocks.create).not.toHaveBeenCalled()
 })
})

 describe('export API authorization',()=>{
 it.each(['Wojtek','Piotrek','Mateusz','Łukasz','Greg'])('lets %s download only their own crew report',async crewName=>{
  tables.Brygady[0].fields['Nazwa brygady']=crewName
  tables['Postęp robót']=[{id:'own-report',fields:{Data:'2026-09-30',Brygada:['mine'],'Powiązana budowa':['new'],Budynek:['new-building'],'Wykonano m²':10,'Stawka brygady zł/m²':25},createdTime:''},{id:'other-report',fields:{Data:'2026-09-30',Brygada:['other'],'Wykonano m²':999},createdTime:''}]
  const response=await request('reports/export?from=2026-09-30&to=2026-09-30&crewId=other')
  expect(response.status).toBe(200);const data=await response.json();expect(data.title).toBe('Brygada: '+crewName);expect(data.rows.map((r:any)=>r.id)).toEqual(['own-report']);expect(data.totals.earnings).toBe(250)
 })
 it('allows an admin all crews and rejects an invalid date range',async()=>{
  mocks.getUser.mockResolvedValue({id:'admin',email:'admin@example.test'})
  const response=await request('reports/export?from=2026-09-01&to=2026-09-30');expect(response.status).toBe(200);expect((await response.json()).title).toBe('Wszystkie brygady')
  expect((await request('reports/export?from=2026-09-30&to=2026-09-01')).status).toBe(400)
 })
 it('rejects export by anonymous or blocked users',async()=>{
  mocks.getUser.mockResolvedValue(null);expect((await request('reports/export')).status).toBe(401)
  mocks.getUser.mockResolvedValue({id:'user',email:'foreman@example.test',appMetadata:{blocked:true}});expect((await request('reports/export')).status).toBe(401)
 })
 })
