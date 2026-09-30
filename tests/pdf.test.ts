import {describe,expect,it,vi} from 'vitest'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {makeExportPdf,reportGroups,downloadPdf} from '../src/pdf'
import type {ExportReport} from '../src/types'
const report:ExportReport={from:'2026-09-01',to:'2026-09-30',title:'Wszystkie brygady',kind:'meters',site:'Wszystkie budowy',sites:[],totals:{meters:30,hours:0,earnings:600},rows:[
 {id:'1',date:'2026-09-30',crewId:'c1',crew:'Łukasz',siteId:'s1',site:'Nowa Dęba – Mirbud',buildingId:'b1',building:'Budynek A',zone:'Piętro 2',meters:10,hours:0,rate:20,earnings:200,notes:'Ściany i wnęki'},
 {id:'2',date:'2026-09-30',crewId:'c2',crew:'Piotrek',siteId:'s1',site:'Nowa Dęba – Mirbud',buildingId:'b2',building:'Budynek B',zone:'',meters:20,hours:0,rate:20,earnings:400,notes:''}
]}
describe('PDF exports',()=>{
 it('groups totals by site and optionally each building',()=>{expect(reportGroups(report,false)).toHaveLength(1);const groups=reportGroups(report,true);expect(groups.map(x=>x.meters)).toEqual([10,20]);expect(groups.reduce((n,g)=>n+g.earnings,0)).toBe(600)})
 it('generates Unicode, multipage and empty PDF files',async()=>{
 const font=readFileSync('public/fonts/DejaVuSans.ttf').toString('base64')
 const longRows=Array.from({length:70},(_,i)=>({...report.rows[i%2],id:String(i),notes:i===0?'Bardzo długa uwaga: '.repeat(28):'Zażółć gęślą jaźń. Prace sprawdzone.'}))
 const long={...report,rows:longRows,totals:{meters:1050,hours:0,earnings:21000}}
 const cases:Array<[string,ExportReport,boolean]>=[['budynki',report,true],['wielostronicowy',long,true],['pusty',{...report,rows:[],totals:{meters:0,hours:0,earnings:0}},false]]
 for(const [name,r,group] of cases){const blob=await makeExportPdf(r,group,font);const bytes=Buffer.from(await blob.arrayBuffer());expect(blob.type).toBe('application/pdf');expect(bytes.toString('latin1')).toContain('%PDF-1.3');expect(bytes.toString('latin1')).toContain('/FontFile2');if(process.env.PDF_QA_DIR){mkdirSync(process.env.PDF_QA_DIR,{recursive:true});writeFileSync(`${process.env.PDF_QA_DIR}/${name}.pdf`,bytes)}}
 })
 it('downloads a file directly without requiring a share dialog',()=>{
 const a={href:'',download:'',click:vi.fn(),remove:vi.fn()};vi.stubGlobal('document',{createElement:()=>a,body:{appendChild:vi.fn()}});vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:test');vi.useFakeTimers();downloadPdf(new Blob(['test']),'report.pdf');expect(a.download).toBe('report.pdf');expect(a.click).toHaveBeenCalledOnce();vi.runAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks()
 })
})
