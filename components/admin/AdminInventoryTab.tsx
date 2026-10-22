"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  upsertInventoryItem, 
  adjustStock, 
  toggleInventoryItemActive, 
  saveServiceRecipe, 
  deleteServiceRecipe 
} from "@/lib/actions/inventory";
import type { 
  InventoryItemWithDetails, 
  ServiceRecipeWithDetails, 
  InventoryMovementWithDetails,
  ServiceRow 
} from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  History, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp, 
  ArrowUpDown,
  Calendar,
  User,
  Trash2
} from "lucide-react";

type Props = {
  inventoryItems: InventoryItemWithDetails[];
  recipes: ServiceRecipeWithDetails[];
  movements: InventoryMovementWithDetails[];
  services: ServiceRow[];
};

export function AdminInventoryTab({ inventoryItems, recipes, movements, services }: Props) {
  const [subTab, setSubTab] = useState<"items" | "recipes" | "ledger">("items");
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemWithDetails | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItemWithDetails | null>(null);
  const [addingRecipe, setAddingRecipe] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const lowStockItems = inventoryItems.filter((i) => i.is_low_stock && i.is_active);

  function handleToggleActive(id: string, current: boolean) {
    setFeedback(null);
    startTransition(async () => {
      const res = await toggleInventoryItemActive(id, !current);
      if (res.error) setFeedback({ type: "error", text: res.error });
      else setFeedback({ type: "success", text: "Item status updated." });
    });
  }

  function handleDeleteRecipe(id: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteServiceRecipe(id);
      if (res.error) setFeedback({ type: "error", text: res.error });
      else setFeedback({ type: "success", text: "Usage rule removed." });
    });
  }

  return (
    <div className="space-y-6">
      {/* Overview & Subtabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-ink/10 pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Inventory & Salon Supplies</h2>
          <p className="text-sm text-ink-soft">
            Manage product inventory, track consumption per service and staff, and monitor stock levels.
          </p>
        </div>

        {/* Subtab Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={subTab === "items" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setSubTab("items")}
          >
            <Package className="mr-1.5 h-3.5 w-3.5" />
            Products ({inventoryItems.length})
          </Button>
          <Button
            size="sm"
            variant={subTab === "recipes" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setSubTab("recipes")}
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Service Usage ({recipes.length})
          </Button>
          <Button
            size="sm"
            variant={subTab === "ledger" ? "default" : "outline"}
            className="text-xs"
            onClick={() => setSubTab("ledger")}
          >
            <History className="mr-1.5 h-3.5 w-3.5" />
            Movement Log ({movements.length})
          </Button>
        </div>
      </div>

      {/* Global Action Feedback Alert */}
      {feedback && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl p-4 text-sm font-medium border",
            feedback.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
              : "bg-rose-50 text-rose-800 border-rose-200"
          )}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Low Stock Warning Banner */}
      {lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-950">
              Low Stock Alert ({lowStockItems.length} product{lowStockItems.length === 1 ? "" : "s"} at or below minimum threshold):
            </p>
            <p className="text-amber-800/90">
              {lowStockItems.map((i) => `${i.name} (${i.current_stock} ${i.unit} left, threshold: ${i.low_stock_threshold})`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {/* SUBTAB 1: PRODUCT INVENTORY */}
      {subTab === "items" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-ink">Product Catalog</h3>
            {!addingItem && !editingItem && !adjustingItem && (
              <Button size="sm" onClick={() => setAddingItem(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Product
              </Button>
            )}
          </div>

          {/* Add / Edit Form */}
          {(addingItem || editingItem) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await upsertInventoryItem(formData);
                  if (res.error) setFeedback({ type: "error", text: res.error });
                  else {
                    setFeedback({ type: "success", text: res.message || "Product saved." });
                    setAddingItem(false);
                    setEditingItem(null);
                  }
                });
              }}
              className="grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-3 border border-ink/10"
            >
              {editingItem && <input type="hidden" name="id" value={editingItem.id} />}
              <div className="sm:col-span-2">
                <Label htmlFor="itemName">Product Name</Label>
                <Input id="itemName" name="name" defaultValue={editingItem?.name} required placeholder="e.g. Medical Grade Lash Adhesive 5ml" />
              </div>
              <div>
                <Label htmlFor="itemCategory">Category</Label>
                <Input id="itemCategory" name="category" defaultValue={editingItem?.category ?? "Consumables"} placeholder="e.g. Lash Products, Consumables" />
              </div>
              <div>
                <Label htmlFor="itemSku">SKU / Code (Optional)</Label>
                <Input id="itemSku" name="sku" defaultValue={editingItem?.sku ?? ""} placeholder="e.g. GLUE-MED-05" />
              </div>
              <div>
                <Label htmlFor="itemUnit">Unit of Measure</Label>
                <Input id="itemUnit" name="unit" defaultValue={editingItem?.unit ?? "pcs"} required placeholder="e.g. pcs, ml, pairs, trays" />
              </div>
              <div>
                <Label htmlFor="itemStock">Current Stock</Label>
                <Input id="itemStock" name="currentStock" type="number" step="0.1" defaultValue={editingItem?.current_stock ?? 10} required />
              </div>
              <div>
                <Label htmlFor="itemThreshold">Low Stock Alert Threshold</Label>
                <Input id="itemThreshold" name="lowStockThreshold" type="number" step="1" defaultValue={editingItem?.low_stock_threshold ?? 5} required />
              </div>
              <div>
                <Label htmlFor="itemCost">Cost per Unit (PHP)</Label>
                <Input id="itemCost" name="costPerUnit" type="number" step="0.01" defaultValue={editingItem?.cost_per_unit ?? 0} />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor="itemNotes">Notes / Specifications</Label>
                <Textarea id="itemNotes" name="notes" defaultValue={editingItem?.notes ?? ""} placeholder="Storage instructions, brand specifications..." />
              </div>
              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Saving..." : editingItem ? "Update Product" : "Save Product"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingItem(false); setEditingItem(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Adjust Stock Form */}
          {adjustingItem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const change = Number(formData.get("changeQuantity") ?? 0);
                const reason = String(formData.get("reason") ?? "");
                const type = String(formData.get("movementType") ?? "adjustment") as any;
                startTransition(async () => {
                  const res = await adjustStock(adjustingItem.id, change, reason, type);
                  if (res.error) setFeedback({ type: "error", text: res.error });
                  else {
                    setFeedback({ type: "success", text: res.message || "Stock adjusted." });
                    setAdjustingItem(null);
                  }
                });
              }}
              className="grid gap-4 rounded-2xl bg-indigo-50/60 p-5 sm:grid-cols-3 border border-indigo-200"
            >
              <div className="sm:col-span-3">
                <h4 className="font-display font-semibold text-indigo-950">
                  Adjust Stock for: {adjustingItem.name}
                </h4>
                <p className="text-xs text-indigo-800">
                  Current stock balance: <strong>{adjustingItem.current_stock} {adjustingItem.unit}</strong>
                </p>
              </div>
              <div>
                <Label htmlFor="movementType" className="text-indigo-950">Adjustment Type</Label>
                <Select id="movementType" name="movementType" defaultValue="restock" className="bg-white">
                  <option value="restock">Restock / Received Shipment (+)</option>
                  <option value="adjustment">Inventory Count Adjustment (+/-)</option>
                  <option value="waste">Damage / Expired / Waste (-)</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="changeQuantity" className="text-indigo-950">
                  Change Quantity (+ or -)
                </Label>
                <Input id="changeQuantity" name="changeQuantity" type="number" step="0.1" required placeholder="e.g. 10 or -2" className="bg-white" />
              </div>
              <div className="sm:col-span-3">
                <Label htmlFor="adjustReason" className="text-indigo-950">Reason for Adjustment</Label>
                <Input id="adjustReason" name="reason" required placeholder="e.g. Supplier delivery PO-9842 or weekly audit discrepancy" className="bg-white" />
              </div>
              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isPending}>
                  {isPending ? "Recording..." : "Record Adjustment"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAdjustingItem(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Items List */}
          <div className="space-y-3">
            {inventoryItems.length === 0 ? (
              <Card className="p-8 text-center text-ink-soft">
                No inventory items defined yet. Click &quot;Add Product&quot; to initialize your supplies catalog.
              </Card>
            ) : (
              inventoryItems.map((item) => (
                <Card key={item.id} className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border border-ink/10">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-base font-semibold text-ink">{item.name}</p>
                      <span className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        item.is_active ? "bg-emerald-100 text-emerald-800" : "bg-ink/10 text-ink-soft"
                      )}>
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                      <span className="font-medium text-gold-dark">{item.category}</span>
                      {item.sku && <span>&middot; SKU: {item.sku}</span>}
                      {item.cost_per_unit > 0 && <span>&middot; Cost: ₱{item.cost_per_unit.toFixed(2)} / {item.unit}</span>}
                    </div>

                    {item.notes && <p className="text-xs text-ink-soft italic pt-1">{item.notes}</p>}

                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-bold flex items-center gap-1.5",
                        item.is_low_stock 
                          ? "bg-rose-100 text-rose-800 border border-rose-200" 
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      )}>
                        {item.is_low_stock ? <TrendingDown className="h-3.5 w-3.5 text-rose-600" /> : <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                        Stock: {item.current_stock} {item.unit}
                      </span>
                      <span className="text-[11px] text-ink-soft">
                        (Low-stock alert below {item.low_stock_threshold} {item.unit})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs bg-indigo-50/50 hover:bg-indigo-50 border-indigo-200 text-indigo-900"
                      onClick={() => { setAdjustingItem(item); setEditingItem(null); setAddingItem(false); }}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-indigo-600" /> Adjust Stock
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => { setEditingItem(item); setAdjustingItem(null); setAddingItem(false); }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      disabled={isPending}
                      onClick={() => handleToggleActive(item.id, item.is_active)}
                    >
                      {item.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: SERVICE USAGE RECIPES */}
      {subTab === "recipes" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">Products Consumed per Service</h3>
              <p className="text-xs text-ink-soft">
                Define the supplies automatically deducted whenever an appointment for that service is completed.
              </p>
            </div>
            {!addingRecipe && (
              <Button size="sm" onClick={() => setAddingRecipe(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Consumption Rule
              </Button>
            )}
          </div>

          {/* Add Recipe Form */}
          {addingRecipe && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  const res = await saveServiceRecipe(formData);
                  if (res.error) setFeedback({ type: "error", text: res.error });
                  else {
                    setFeedback({ type: "success", text: res.message || "Rule saved." });
                    setAddingRecipe(false);
                  }
                });
              }}
              className="grid gap-4 rounded-2xl bg-cream p-5 sm:grid-cols-3 border border-ink/10"
            >
              <div>
                <Label htmlFor="serviceId">Salon Service</Label>
                <Select id="serviceId" name="serviceId" required className="bg-white">
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="inventoryItemId">Consumed Inventory Item</Label>
                <Select id="inventoryItemId" name="inventoryItemId" required className="bg-white">
                  {inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity Used per Service</Label>
                <Input id="quantity" name="quantity" type="number" step="0.1" defaultValue="1" required placeholder="e.g. 1 or 0.5" />
              </div>

              <div className="sm:col-span-3">
                <Label htmlFor="recipeNotes">Notes (Optional)</Label>
                <Input id="recipeNotes" name="notes" placeholder="e.g. Standard 2-drop dosage" />
              </div>

              <div className="flex gap-2 sm:col-span-3">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Product Consumption Rule"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAddingRecipe(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Recipes grouped by service */}
          <div className="space-y-4">
            {services.map((svc) => {
              const svcRecipes = recipes.filter((r) => r.service_id === svc.id);

              return (
                <Card key={svc.id} className="p-5 space-y-3 border border-ink/10">
                  <div className="flex items-center justify-between border-b border-ink/10 pb-2">
                    <div>
                      <h4 className="font-display font-semibold text-ink">{svc.name}</h4>
                      <p className="text-xs text-gold-dark font-medium">{svc.category} &middot; ₱{svc.price} &middot; {svc.duration_minutes} mins</p>
                    </div>
                    <span className="text-xs font-semibold text-ink-soft bg-ink/5 px-2.5 py-1 rounded-md">
                      {svcRecipes.length} item{svcRecipes.length === 1 ? "" : "s"} consumed
                    </span>
                  </div>

                  {svcRecipes.length === 0 ? (
                    <p className="text-xs text-ink-soft italic py-1">
                      No inventory items currently linked to this service.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {svcRecipes.map((r) => (
                        <div key={r.id} className="flex items-center justify-between rounded-xl bg-cream/60 p-3 border border-ink/5">
                          <div className="text-xs space-y-0.5">
                            <p className="font-semibold text-ink">{r.inventory_items?.name ?? "Supply Item"}</p>
                            <p className="text-ink-soft">
                              Consumes: <strong className="text-ink">{r.quantity} {r.inventory_items?.unit ?? "units"}</strong> per appointment
                            </p>
                            {r.notes && <p className="text-[11px] text-ink-soft italic">{r.notes}</p>}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleDeleteRecipe(r.id)}
                            title="Remove consumption rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: STOCK MOVEMENT LEDGER (AUDIT TRAIL) */}
      {subTab === "ledger" && (
        <div className="space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Stock Movement Ledger</h3>
            <p className="text-xs text-ink-soft">
              Immutable audit history of all restocks, adjustments, and appointment service deductions with staff attribution.
            </p>
          </div>

          <div className="space-y-3">
            {movements.length === 0 ? (
              <Card className="p-8 text-center text-ink-soft">
                No inventory movements recorded yet. Stock deductions and adjustments will appear here.
              </Card>
            ) : (
              movements.map((m) => {
                const isPositive = m.change_quantity > 0;

                return (
                  <Card key={m.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-ink/10 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink text-sm">{m.inventory_items?.name ?? "Inventory Item"}</span>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          m.movement_type === "service_consumption" ? "bg-amber-100 text-amber-800" :
                          m.movement_type === "restock" ? "bg-emerald-100 text-emerald-800" :
                          "bg-indigo-100 text-indigo-800"
                        )}>
                          {m.movement_type.replace("_", " ")}
                        </span>
                      </div>

                      <p className="text-ink-soft">
                        Reason: <strong className="text-ink">{m.reason}</strong>
                      </p>

                      {/* Staff & Appointment attribution */}
                      {(m.staff?.full_name || m.appointments?.full_name || m.services?.name) && (
                        <div className="flex flex-wrap items-center gap-2 text-ink-soft pt-0.5">
                          {m.staff?.full_name && (
                            <span className="flex items-center gap-1 bg-ink/5 px-2 py-0.5 rounded text-[11px]">
                              <User className="h-3 w-3 text-gold-dark" /> Staff: {m.staff.full_name}
                            </span>
                          )}
                          {m.appointments?.full_name && (
                            <span className="bg-ink/5 px-2 py-0.5 rounded text-[11px]">
                              Client: {m.appointments.full_name}
                            </span>
                          )}
                          {m.services?.name && (
                            <span className="bg-ink/5 px-2 py-0.5 rounded text-[11px]">
                              Service: {m.services.name}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-[11px] text-ink-soft flex items-center gap-1">
                        <Calendar className="h-3 w-3 inline text-ink-soft" />
                        {new Date(m.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="text-right sm:border-l sm:border-ink/10 sm:pl-4">
                      <p className={cn(
                        "text-base font-bold",
                        isPositive ? "text-emerald-700" : "text-rose-700"
                      )}>
                        {isPositive ? `+${m.change_quantity}` : m.change_quantity} {m.inventory_items?.unit ?? "units"}
                      </p>
                      <p className="text-[11px] text-ink-soft">
                        Balance: {m.previous_stock} &rarr; <strong>{m.new_stock}</strong>
                      </p>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
