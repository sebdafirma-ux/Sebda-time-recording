import {useEffect,useState} from 'react'
import {Activity,ChevronRight,Download,Users,X} from 'lucide-react'
import {api} from './api'
import {periodDates} from './report-periods'
import HistoryPanel from './HistoryPanel'
import type {CompanyOverview,ExportReport,Option,Role} from './types'
const number=(n:number)=>n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function DashboardExtras({role,onMessage}:{role:Role;onMessage:(s:string)=>void}){
 const initial=periodDates('month')
 const [from,setFrom]=useState(initial.from),[to,setTo]=useState(initial.to)
 const [overview,setOverview]=useState<CompanyOverview>(),[selectedCrew,setSelectedCrew]=useState('')
 const [siteId,setSiteId]=useState(''),[byBuilding,setByBuilding]=useState(false)
 const [sites,setSites]=useState<Option[]>([])
 const [report,setReport]=useState<ExportReport>(),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 useEffect(()=>{document.body.dataset.role=role;if(role!=='admin')return;const load=()=>api.overview().then(setOverview).catch(e=>onMessage((e as Error).message));load();const id=setInterval(load,60000);return()=>clearInterval(id)},[role])
 useEffect(()=>{
  let current=true;setReport(undefined)
  if(!from||!to||from>to){setLoading(false);return()=>{current=false}}
  setLoading(true)
  api.exportReport(from,to,selectedCrew,siteId).then(r=>{if(current){setReport(r);setSites(r.sites)}}).catch(e=>{if(current)onMessage((e as Error).message)}).finally(()=>{if(current)setLoading(false)})
  return()=>{current=false}
 },[from,to,selectedCrew,siteId,role])
 function chooseCrew(id:string){setSelectedCrew(id);setSiteId('')}
 function period(p:'day'|'week'|'month'){const dates=periodDates(p);setFrom(dates.from);setTo(dates.to)}
 async function pdf(){
  if(!report||from>to)return
  setBusy(true)
  try{
   const current=await api.exportReport(from,to,selectedCrew,siteId)
   const {makeExportPdf,downloadPdf}=await import('./pdf')
   const blob=await makeExportPdf(current,byBuilding&&role!=='helper')
   const title=current.title.replace(/[^\p{L}\p{N}]+/gu,'-')
   downloadPdf(blob,`SEBDA-${title}-${from}-${to}${siteId?'-budowa':''}${byBuilding?'-budynki':''}.pdf`)
   onMessage('PDF gotowy. Pobieranie rozpoczęte.')
  }catch(e){onMessage((e as Error).message)}finally{setBusy(false)}
 }
 const crew=overview?.crews.find(x=>x.id===selectedCrew)
 const allTotals=overview?.crews.reduce((sum,c)=>({meters:sum.meters+c.meters,earnings:sum.earnings+c.earnings}),{meters:0,earnings:0})
 return <section className={`content extras ${role==='admin'?'admin-extras':''}`}>
  {role==='admin'&&<>
   <div className="live-box">
    <div className="section-title"><p className="eyebrow">Dzisiaj · aktualizacja co minutę</p><h2><Activity/>Firma na żywo</h2><p>Wybierz jedną brygadę lub wszystkie, aby zobaczyć dzisiejsze m² i rozliczenie.</p></div>
    <button className={`all-crews ${!selectedCrew?'selected':''}`} aria-pressed={!selectedCrew} onClick={()=>chooseCrew('')}><Users/><span><strong>Wszystkie brygady</strong><small>{overview?`${overview.crews.length} brygad · ${number(allTotals!.meters)} m² · ${number(allTotals!.earnings)} zł`:'Ładowanie…'}</small></span></button>
    <div className="click-grid">{overview?.crews.map(x=><button key={x.id} aria-pressed={selectedCrew===x.id} className={selectedCrew===x.id?'selected':''} onClick={()=>chooseCrew(x.id)}><div><strong>{x.name}</strong><small>{x.site||'Brak dzisiejszych wpisów na budowie'} · {number(x.meters)} m² · {number(x.earnings)} zł</small></div><ChevronRight/></button>)}</div>
    {!selectedCrew&&overview&&<div className="admin-table-wrap"><table><caption>Dzisiejsze rozliczenie wszystkich brygad</caption><thead><tr><th>Brygada</th><th>Budowa</th><th>m²</th><th>Zarobek</th></tr></thead><tbody>{overview.crews.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.site||'—'}</td><td>{number(x.meters)}</td><td>{number(x.earnings)} zł</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Razem</th><td>{number(allTotals!.meters)}</td><td>{number(allTotals!.earnings)} zł</td></tr></tfoot></table></div>}
   </div>
   {crew&&<div className="detail-card"><button className="iconbtn" aria-label="Pokaż wszystkie brygady" onClick={()=>chooseCrew('')}><X/></button><h3>{crew.name} · dzisiaj</h3><dl>{[['Brygadzista',crew.foreman],['Budowa',crew.site||'Brak dzisiejszych wpisów'],['Wykonano',`${number(crew.meters)} m²`],['Zarobek brygady',`${number(crew.earnings)} zł`]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>}
  </>}
  <div className="personal-report report-builder">
   <div><p className="eyebrow">Raport PDF</p><h3><Download/>{role==='admin'?(crew?`Raport: ${crew.name}`:'Raport: wszystkie brygady'):'Twój raport'}</h3><p>{role==='helper'?'Twój czas pracy i rozliczenie.':'Wykonane m², stawki i zarobek. Wybierz okres oraz budowę.'}</p></div>
   <div className="period-buttons" aria-label="Okres raportu"><button onClick={()=>period('day')}>Dzień</button><button onClick={()=>period('week')}>Tydzień</button><button onClick={()=>period('month')}>Miesiąc</button></div>
   <div className="report-filters">
    <label>Od<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Do<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    <label>Budowa do raportu<select value={siteId} onChange={e=>setSiteId(e.target.value)}><option value="">Wszystkie budowy</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   </div>
   {role!=='helper'&&<label className="check report-breakdown"><input type="checkbox" checked={byBuilding} onChange={e=>setByBuilding(e.target.checked)}/>Podsumowanie z podziałem na budynki</label>}
   {from>to&&<p className="form-error">Data „Od” nie może być późniejsza niż „Do”.</p>}
   {loading?<p role="status">Ładowanie raportu…</p>:report&&<p className="report-total">{report.rows.length} wpisów · {number(report.kind==='hours'?report.totals.hours:report.totals.meters)} {report.kind==='hours'?'h':'m²'} · {number(report.totals.earnings)} zł{!report.rows.length?' · Brak wpisów w wybranym zakresie.':''}</p>}
   <button className="primary" disabled={busy||loading||!report||!from||!to||from>to} onClick={pdf}><Download size={17}/>{busy?'Przygotowywanie PDF…':'Pobierz PDF'}</button>
  </div>
  {(role!=='admin'||selectedCrew)&&<HistoryPanel key={`${role}-${selectedCrew}-${from}-${to}`} role={role} crewId={selectedCrew} from={from} to={to} onMessage={onMessage}/>}
 </section>
}
