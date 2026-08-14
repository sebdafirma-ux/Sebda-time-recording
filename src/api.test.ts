import{describe,expect,it}from'vitest'
describe('security boundary',()=>{it('keeps Airtable secrets out of client environment',()=>{expect('AIRTABLE_TOKEN' in import.meta.env).toBe(false)})})
