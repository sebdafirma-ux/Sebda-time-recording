export function periodDates(period:'day'|'week'|'month',today=new Date()){
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw'}).format(today)
 const start=new Date(`${date}T12:00:00Z`),end=new Date(start)
 if(period==='week'){start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end.setTime(start.getTime());end.setUTCDate(start.getUTCDate()+6)}
 if(period==='month'){start.setUTCDate(1);end.setUTCMonth(end.getUTCMonth()+1,0)}
 return {from:start.toISOString().slice(0,10),to:end.toISOString().slice(0,10)}
}
