export type ReturnLine = { itemId:string;equipmentId:string;equipmentName:string;good:number;damaged:number;outstandingAfter:number };
export type ReturnEvent = {id:string;actorName:string;notes:string;createdAt:string;lines:ReturnLine[]};
export type ReturnItem = {id:string;quantity:number;equipmentName?:string;equipment?:{name?:string|null}|null;returnedGood?:number;returnedDamaged?:number};
export type ReturnRequest = {id:string;updatedAt?:string|null;items?:ReturnItem[]};
