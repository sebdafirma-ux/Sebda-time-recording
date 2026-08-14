import{describe,expect,it}from'vitest'
import{makeReportPdf}from'./pdf'
describe('PDF reports',()=>{it('creates a valid PDF document',async()=>{const blob=makeReportPdf('SEBDA raport','2026-08-01','2026-08-31',[{date:'2026-08-14',description:'Budowa A',hours:8,meters:120}],{hours:8,meters:120});const text=new TextDecoder().decode(await blob.arrayBuffer());expect(blob.type).toBe('application/pdf');expect(text.startsWith('%PDF-1.4')).toBe(true);expect(text).toContain('startxref');expect(text).toContain('SEBDA raport')})})
