import { Equipment, EquipmentStatus } from '@prisma/client';
type Stock = Pick<Equipment, 'availableQuantity' | 'borrowedQuantity' | 'damagedQuantity'>;
export function stockStatus(stock: Stock): EquipmentStatus {
  if (stock.availableQuantity > 0) return EquipmentStatus.AVAILABLE;
  if (stock.borrowedQuantity > 0) return EquipmentStatus.BORROWED;
  if (stock.damagedQuantity > 0) return EquipmentStatus.DAMAGED;
  return EquipmentStatus.UNAVAILABLE;
}
// Keep the effective status field compatible with existing clients; the marker
// alone records lifecycle and quantity movements never change it.
export function effectiveStatus(stock: Stock & Pick<Equipment, 'retiredAt'>): EquipmentStatus {
  return stock.retiredAt ? EquipmentStatus.UNAVAILABLE : stockStatus(stock);
}
export function equipmentView<T extends Equipment>(equipment: T) {
  return { ...equipment, stockStatus: stockStatus(equipment) };
}
