export type Role='admin'|'foreman'
export type Option={id:string;name:string;parentId?:string}
export type Bootstrap={user:{name:string;role:Role;crewId?:string};sites:Option[];buildings:Option[];crews:Option[];activeShift?:{id:string;startedAt:string};todayMinutes:number}
export type Report={siteId:string;buildingId:string;crewId:string;squareMeters:number;zone:string;people:number;notes:string;problem?:string}
