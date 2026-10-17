/**
 * Quinn Luxurious — Pure Inventory & Stock Calculations
 */

export interface InventoryItemInput {
  name: string;
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
}

export function validateInventoryItemInput(data: InventoryItemInput): { valid: boolean; error: string | null } {
  if (!data.name || data.name.trim() === "") {
    return { valid: false, error: "Item name is required." };
  }
  if (!data.unit || data.unit.trim() === "") {
    return { valid: false, error: "Unit of measure is required (e.g. pcs, ml, pairs)." };
  }
  if (isNaN(data.currentStock) || data.currentStock < 0) {
    return { valid: false, error: "Stock quantity cannot be negative." };
  }
  if (isNaN(data.lowStockThreshold) || data.lowStockThreshold < 0) {
    return { valid: false, error: "Low-stock threshold cannot be negative." };
  }
  return { valid: true, error: null };
}

export interface StockAdjustmentInput {
  currentStock: number;
  changeQuantity: number;
}

export function validateStockAdjustment(params: StockAdjustmentInput): {
  valid: boolean;
  error: string | null;
  newStock?: number;
} {
  if (isNaN(params.changeQuantity) || params.changeQuantity === 0) {
    return { valid: false, error: "Adjustment quantity must be a non-zero number." };
  }
  const newStock = Number((params.currentStock + params.changeQuantity).toFixed(2));
  if (newStock < 0) {
    return {
      valid: false,
      error: "Cannot complete adjustment: Resulting stock cannot be negative (Current: " + params.currentStock + ", Change: " + params.changeQuantity + ").",
    };
  }
  return { valid: true, error: null, newStock };
}

export function computeIsLowStock(currentStock: number, threshold: number): boolean {
  return currentStock <= threshold;
}
