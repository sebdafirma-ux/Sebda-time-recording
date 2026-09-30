import {jsPDF} from 'jspdf'
import {autoTable} from 'jspdf-autotable'
import type {ExportReport} from './types'
const decimal=(n:number)=>n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}).replace(/\u00a0/g,' ')
const money=(n:number)=>`${decimal(n)} zł`
let fontPromise:Promise<string>|undefined
async function fontData(){
 if(!fontPromise)fontPromise=fetch('/fonts/DejaVuSans.ttf').then(async r=>{if(!r.ok)throw new Error('Nie udało się pobrać czcionki PDF. Spróbuj ponownie.');const bytes=new Uint8Array(await r.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text)}).catch(e=>{fontPromise=undefined;throw e})
 return fontPromise
}
export function reportGroups(report:ExportReport,byBuilding:boolean){
 const groups=new Map<string,{site:string;building:string;meters:number;hours:number;earnings:number}>()
 for(const r of report.rows){const key=JSON.stringify([r.siteId||r.site,byBuilding?r.buildingId||r.building:'']);const g=groups.get(key)||{site:r.site,building:byBuilding?r.building:'',meters:0,hours:0,earnings:0};g.meters+=r.meters;g.hours+=r.hours;g.earnings+=r.earnings;groups.set(key,g)}
 return [...groups.values()].sort((a,b)=>a.site.localeCompare(b.site,'pl')||a.building.localeCompare(b.building,'pl'))
}
export async function makeExportPdf(report:ExportReport,byBuilding=false,font?:string){
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true})
 doc.addFileToVFS('DejaVuSans.ttf',font||await fontData());doc.addFont('DejaVuSans.ttf','SEBDA','normal');doc.setFont('SEBDA')
 const width=182,margin=14;let y=20
 function heading(text:string,size=11){doc.setFontSize(size);const lines=doc.splitTextToSize(text,width);const h=lines.length*(size*0.42)+4;if(y+h>276){doc.addPage();y=20}doc.text(lines,margin,y);y+=h}
 heading('SEBDA | Raport wykonanych prac',17)
 heading(report.title,12)
 heading(`Okres: ${report.from} - ${report.to}`,10)
 heading(`Budowa: ${report.site}`,10)
 heading(report.kind==='hours'?`Czas płatny: ${decimal(report.totals.hours)} h | Kwota: ${money(report.totals.earnings)}`:`Wykonano: ${decimal(report.totals.meters)} m² | Zarobek brygad: ${money(report.totals.earnings)}`,11)
 const styles={font:'SEBDA',fontStyle:'normal' as const,fontSize:8,cellPadding:2.2,overflow:'linebreak' as const,textColor:30}
 const table=(head:string[],body:string[][],columnStyles:Record<number,{cellWidth:number;halign?:'left'|'right'}>)=>{
  autoTable(doc,{head:[head],body,startY:y,margin:{left:margin,right:margin,top:18,bottom:18},styles,headStyles:{fillColor:[0,91,131],textColor:255,fontStyle:'normal'},columnStyles,theme:'striped',rowPageBreak:'avoid'})
  y=(doc as jsPDF&{lastAutoTable:{finalY:number}}).lastAutoTable.finalY+10
 }
 if(!report.rows.length){heading('Brak wpisów w wybranym okresie i zakresie.',11)}else{
  heading(byBuilding?'Podsumowanie według budów i budynków':'Podsumowanie według budów',11)
  const groups=reportGroups(report,byBuilding)
  table(['Budowa / budynek',report.kind==='hours'?'Godziny':'Wykonano m²','Kwota'],groups.map(g=>[[g.site,g.building].filter(Boolean).join('\n'),decimal(report.kind==='hours'?g.hours:g.meters),money(g.earnings)]),{0:{cellWidth:113},1:{cellWidth:30,halign:'right'},2:{cellWidth:39,halign:'right'}})
  if(y>240){doc.addPage();y=20}
  heading('Szczegóły wpisów',11)
  table(['Data','Brygada','Miejsce / uwagi',report.kind==='hours'?'Godziny':'m²',report.kind==='hours'?'Stawka / h':'Stawka / m²','Kwota'],report.rows.map(r=>[
   r.date,r.crew,[r.site,report.kind==='meters'?r.building:'',r.zone,r.notes?`Uwagi: ${r.notes}`:''].filter(Boolean).join('\n'),decimal(report.kind==='hours'?r.hours:r.meters),money(r.rate),money(r.earnings)
  ]),{0:{cellWidth:22},1:{cellWidth:25},2:{cellWidth:65},3:{cellWidth:18,halign:'right'},4:{cellWidth:23,halign:'right'},5:{cellWidth:29,halign:'right'}})
 }
 const count=doc.getNumberOfPages()
 for(let page=1;page<=count;page++){doc.setPage(page);doc.setFontSize(8);doc.setTextColor(100);doc.text('SEBDA | Raport prac',margin,288);doc.text(`${page} / ${count}`,196,288,{align:'right'})}
 return doc.output('blob')
}
export function downloadPdf(blob:Blob,fileName:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
