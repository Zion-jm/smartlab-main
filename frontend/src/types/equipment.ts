export type EquipmentStatus = 'AVAILABLE' | 'BORROWED' | 'DAMAGED' | 'UNAVAILABLE';

export interface EquipmentItem {
  id: string;
  name: string;
  description?: string | null;
  totalQuantity: number;
  availableQuantity: number;
  borrowedQuantity: number;
  damagedQuantity: number;
  status: EquipmentStatus;
  retiredAt?: string | null;
  stockStatus?: EquipmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface EquipmentStats {
  inventory: {
    uniqueItems: number;
    totalQuantity: number;
    availableQuantity: number;
    borrowedQuantity: number;
    damagedQuantity: number;
    archivedQuantity: number;
    lowStockCount: number;
    utilizationRate: number;
  };
  today?: {
    itemsReserved: number;
    quantityReserved: number;
  };
  pendingRequests?: number;
  upcoming?: {
    requests: number;
    quantity: number;
  };
  overdue?: {
    requests: number;
    quantity: number;
  };
  mostReserved?: Array<{
    equipmentId: string;
    equipmentName: string;
    totalReserved: number;
  }>;
}

export interface EquipmentFilters {
  search: string;
  status: EquipmentStatus | 'ALL';
  lowStockOnly: boolean;
}
