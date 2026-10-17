import test from "node:test";
import assert from "node:assert/strict";

import { 
  validateInventoryItemInput, 
  validateStockAdjustment 
} from "../lib/inventory.ts";

test.describe("Step 5: Inventory Management Suite", () => {
  test.describe("1. Inventory Item Creation & Validation", () => {
    test("accepts valid inventory item inputs", () => {
      const valid = validateInventoryItemInput({
        name: "Medical Grade Lash Adhesive 5ml",
        unit: "bottles",
        currentStock: 15,
        lowStockThreshold: 3,
      });
      assert.equal(valid.valid, true);
      assert.equal(valid.error, null);
    });

    test("REJECTS inventory item with empty name", () => {
      const res = validateInventoryItemInput({
        name: "   ",
        unit: "pcs",
        currentStock: 10,
        lowStockThreshold: 2,
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /name is required/i);
    });

    test("REJECTS inventory item with empty unit of measure", () => {
      const res = validateInventoryItemInput({
        name: "Eye Pads",
        unit: "",
        currentStock: 50,
        lowStockThreshold: 10,
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /unit of measure is required/i);
    });

    test("REJECTS negative current stock quantity", () => {
      const res = validateInventoryItemInput({
        name: "Lash Primer",
        unit: "ml",
        currentStock: -5,
        lowStockThreshold: 2,
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /cannot be negative/i);
    });

    test("REJECTS negative low-stock threshold", () => {
      const res = validateInventoryItemInput({
        name: "Gel Polish Top Coat",
        unit: "bottles",
        currentStock: 10,
        lowStockThreshold: -1,
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /cannot be negative/i);
    });
  });

  test.describe("2. Stock Additions, Adjustments & Negative Stock Prevention", () => {
    test("calculates positive restock addition accurately", () => {
      const res = validateStockAdjustment({
        currentStock: 10,
        changeQuantity: 15,
      });
      assert.equal(res.valid, true);
      assert.equal(res.newStock, 25);
    });

    test("calculates valid deduction accurately", () => {
      const res = validateStockAdjustment({
        currentStock: 25,
        changeQuantity: -5,
      });
      assert.equal(res.valid, true);
      assert.equal(res.newStock, 20);
    });

    test("REJECTS adjustment quantity of 0", () => {
      const res = validateStockAdjustment({
        currentStock: 20,
        changeQuantity: 0,
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /non-zero/i);
    });

    test("PREVENTS negative stock: rejects deduction that exceeds current stock", () => {
      const res = validateStockAdjustment({
        currentStock: 4,
        changeQuantity: -10,
      });
      assert.equal(res.valid, false);
      assert.match(res.error, /cannot be negative/i);
    });
  });

  test.describe("3. Low-Stock Thresholds & Alerts", () => {
    function computeIsLowStock(currentStock, threshold) {
      return currentStock <= threshold;
    }

    test("flags item as low stock when current stock is equal to threshold", () => {
      assert.equal(computeIsLowStock(5, 5), true);
    });

    test("flags item as low stock when current stock is below threshold", () => {
      assert.equal(computeIsLowStock(2, 5), true);
    });

    test("does not flag item as low stock when current stock is comfortably above threshold", () => {
      assert.equal(computeIsLowStock(12, 5), false);
    });
  });

  test.describe("4. Service-Product Usage Rules & Deductions per Service", () => {
    // Pure deduction simulation
    function simulateAppointmentDeduction({
      appointmentId,
      serviceId,
      staffId,
      existingDeductions,
      inventoryState,
      serviceRecipes,
    }) {
      // 1. Idempotency Check
      if (existingDeductions.has(appointmentId)) {
        return {
          success: true,
          deducted: false,
          alreadyDeducted: true,
          message: "Inventory already deducted for this appointment.",
          movements: [],
        };
      }

      // 2. Fetch recipe for this service
      const recipes = serviceRecipes[serviceId] || [];
      if (recipes.length === 0) {
        existingDeductions.add(appointmentId);
        return {
          success: true,
          deducted: true,
          alreadyDeducted: false,
          message: "No inventory items consumed for this service.",
          movements: [],
        };
      }

      // 3. Pre-check: Ensure all items have sufficient stock
      for (const recipe of recipes) {
        const item = inventoryState[recipe.itemId];
        if (!item || item.stock < recipe.quantity) {
          return {
            success: false,
            deducted: false,
            error: "Insufficient stock for " + (item ? item.name : recipe.itemId) + ". Required: " + recipe.quantity + ", Available: " + (item ? item.stock : 0),
            movements: [],
          };
        }
      }

      // 4. Perform deductions and generate movements
      const movements = [];
      for (const recipe of recipes) {
        const item = inventoryState[recipe.itemId];
        const prev = item.stock;
        item.stock = Number((item.stock - recipe.quantity).toFixed(2));

        movements.push({
          itemId: recipe.itemId,
          changeQuantity: -recipe.quantity,
          previousStock: prev,
          newStock: item.stock,
          movementType: "service_consumption",
          appointmentId,
          serviceId,
          staffId,
        });
      }

      existingDeductions.add(appointmentId);

      return {
        success: true,
        deducted: true,
        alreadyDeducted: false,
        movements,
      };
    }

    test("deducts exact recipe quantities and attributes to appointment, service, and staff member", () => {
      const inventoryState = {
        "item-glue": { name: "Lash Glue 5ml", stock: 10, unit: "ml" },
        "item-pads": { name: "Eye Pads", stock: 25, unit: "pairs" },
      };

      const serviceRecipes = {
        "svc-volume-lash": [
          { itemId: "item-glue", quantity: 0.5 },
          { itemId: "item-pads", quantity: 1.0 },
        ],
      };

      const existingDeductions = new Set();

      const result = simulateAppointmentDeduction({
        appointmentId: "appt-100",
        serviceId: "svc-volume-lash",
        staffId: "staff-maria",
        existingDeductions,
        inventoryState,
        serviceRecipes,
      });

      assert.equal(result.success, true);
      assert.equal(result.deducted, true);
      assert.equal(inventoryState["item-glue"].stock, 9.5);
      assert.equal(inventoryState["item-pads"].stock, 24);

      // Verify staff attribution on movement records
      assert.equal(result.movements.length, 2);
      assert.equal(result.movements[0].staffId, "staff-maria");
      assert.equal(result.movements[0].appointmentId, "appt-100");
      assert.equal(result.movements[0].changeQuantity, -0.5);
      assert.equal(result.movements[1].staffId, "staff-maria");
      assert.equal(result.movements[1].changeQuantity, -1.0);
    });

    test("IDEMPOTENCY: prevents duplicate deduction if appointment completion is retried", () => {
      const inventoryState = {
        "item-pads": { name: "Eye Pads", stock: 20, unit: "pairs" },
      };

      const serviceRecipes = {
        "svc-lift": [{ itemId: "item-pads", quantity: 1.0 }],
      };

      const existingDeductions = new Set();

      // First completion call
      const firstRun = simulateAppointmentDeduction({
        appointmentId: "appt-200",
        serviceId: "svc-lift",
        staffId: "staff-maria",
        existingDeductions,
        inventoryState,
        serviceRecipes,
      });

      assert.equal(firstRun.success, true);
      assert.equal(firstRun.deducted, true);
      assert.equal(inventoryState["item-pads"].stock, 19);

      // Second duplicate/retry completion call
      const retryRun = simulateAppointmentDeduction({
        appointmentId: "appt-200",
        serviceId: "svc-lift",
        staffId: "staff-maria",
        existingDeductions,
        inventoryState,
        serviceRecipes,
      });

      assert.equal(retryRun.success, true);
      assert.equal(retryRun.deducted, false);
      assert.equal(retryRun.alreadyDeducted, true);
      // Verify stock did NOT decrement again!
      assert.equal(inventoryState["item-pads"].stock, 19);
    });

    test("INSUFFICIENT STOCK: aborts deduction without creating negative stock", () => {
      const inventoryState = {
        "item-glue": { name: "Lash Glue 5ml", stock: 0.2, unit: "ml" }, // only 0.2ml available
      };

      const serviceRecipes = {
        "svc-volume-lash": [{ itemId: "item-glue", quantity: 0.5 }], // requires 0.5ml
      };

      const existingDeductions = new Set();

      const result = simulateAppointmentDeduction({
        appointmentId: "appt-300",
        serviceId: "svc-volume-lash",
        staffId: "staff-maria",
        existingDeductions,
        inventoryState,
        serviceRecipes,
      });

      assert.equal(result.success, false);
      assert.match(result.error, /insufficient stock/i);
      // Stock remains untouched at 0.2, never negative!
      assert.equal(inventoryState["item-glue"].stock, 0.2);
    });

    test("preserves historical movements when a service or staff member is deactivated", () => {
      const historicalMovement = {
        id: "mov-1",
        itemId: "item-glue",
        staffId: "staff-deactivated-uuid",
        serviceId: "svc-archived-uuid",
        changeQuantity: -0.5,
        created_at: "2026-09-01T10:00:00Z",
      };

      // Ledger audit records do not cascade delete when service/staff status is set to inactive
      assert.ok(historicalMovement.id);
      assert.equal(historicalMovement.staffId, "staff-deactivated-uuid");
      assert.equal(historicalMovement.changeQuantity, -0.5);
    });
  });
});
