export type Role='admin'|'foreman'|'helper'
export type Option={id:string;name:string;parentId?:string}
export type Bootstrap={user:{name:string;role:Role;crewId?:string};sites:Option[];buildings:Option[];crews:Option[];crewSites:Record<string,string[]>;activeShift?:{id:string;startedAt:string;crewId?:string;siteId?:string};todayMinutes:number;contact:{company:string;owner:string;email:string;phone:string}}
export type Report={siteId:string;buildingId:string;crewId:string;squareMeters:number;zone:string;people:number;notes:string;problem?:string}
export type AdminResource='crews'|'helpers'|'sites'|'buildings'|'reports'|'photos'|'problems'|'shifts'|'helperShifts'|'invoices'|'costs'
export type AdminRow={id:string;[key:string]:unknown}
export type AdminData=Record<AdminResource,AdminRow[]>
export type SummaryRow={date:string;type:string;person:string;crew:string;site:string;hours:number;meters:number;cost:number}
export type Summary={from:string;to:string;totals:{foremanHours:number;helperHours:number;helperCost:number;crewEarnings:number;totalPayroll:number;meters:number;problems:number};rows:SummaryRow[]}
export type Account={id:string;email:string;name:string;role:string;blocked:boolean;lastSignInAt:string;createdAt:string}
export type PersonalReport={from:string;to:string;title:string;totals:{hours:number;meters:number};rows:Array<{date:unknown;description:unknown;hours:number;meters:number}>}
export type LiveDashboard={counts:{crews:number;helpers:number;sites:number;active:number};active:Array<{person:string;role:string;crew:string;site:string;startedAt:string}>;today:{hours:number;meters:number;reports:number}}
export type CompanyOverview={crews:Array<{id:string;name:string;foreman:string;active:boolean;site:string;startedAt:string;hours:number;meters:number;earnings:number;helperCost:number;helperHours:number;helpers:string[]}>;helpers:Array<{id:string;name:string;email:string;active:boolean;crewIds:string[];site:string;startedAt:string;hours:number;cost:number;rate:number}>}
export type CrewReport={from:string;to:string;title:string;totals:{hours:number;meters:number;earnings:number;helperCost:number};rows:Array<{date:unknown;description:unknown;hours:number;meters:number;earnings:number}>}
export type History={from:string;to:string;days:Array<{date:string;start:string;end:string;hours:number;site:string;meters:number;earnings:number;helperCost:number}>}

export type Finance={from:string;to:string;settings:{materialRate:number;taxRate:number;fixedMonthly:number;privateMonthly:number;reserveMonthly:number;savingsGoal:number};totals:{meters:number;revenue:number;material:number;subcontractors:number;helperCost:number;tax:number;grossMargin:number;overhead:number;netSurplus:number;savingsProgress:number};rows:Array<{date:unknown;site:string;crew:string;meters:number;saleRate:number;subRate:number;revenue:number;material:number;subcontractor:number;margin:number}>}
export type ExportRow={id:string;date:string;crewId:string;crew:string;siteId:string;site:string;buildingId:string;building:string;zone:string;meters:number;hours:number;rate:number;earnings:number;notes:string}
export type ExportReport={from:string;to:string;title:string;kind:'meters'|'hours';site:string;sites:Option[];rows:ExportRow[];totals:{meters:number;hours:number;earnings:number}}

export type PhotoUpload={siteId:string;buildingId:string;crewId?:string;description?:string;filename:string;contentType:string;base64:string}
