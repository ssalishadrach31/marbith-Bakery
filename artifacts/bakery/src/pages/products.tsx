import { useState } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { queryClient } from "@/lib/query-client";
import { formatUGX } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";

type ProductForm = { name: string; price: string; unit: string; category: string; lowStockThreshold: string; isActive: boolean };

export default function ProductsPage() {
  const { data: products, isLoading } = useListProducts({ query: { queryKey: getListProductsQueryKey() } });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>({ name: "", price: "", unit: "piece", category: "baked_goods", lowStockThreshold: "10", isActive: true });

  function openCreate() { setEditId(null); setForm({ name: "", price: "", unit: "piece", category: "baked_goods", lowStockThreshold: "10", isActive: true }); setShowForm(true); }
  function openEdit(p: typeof products extends (infer T)[] | undefined ? T : never) {
    setEditId(p.id);
    setForm({ name: p.name, price: String(p.price), unit: p.unit, category: p.category, lowStockThreshold: String(p.lowStockThreshold), isActive: p.isActive });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = { name: form.name, price: parseFloat(form.price), unit: form.unit, category: form.category, lowStockThreshold: parseInt(form.lowStockThreshold), isActive: form.isActive };
    try {
      if (editId) {
        await updateProduct.mutateAsync({ id: editId, data });
      } else {
        await createProduct.mutateAsync({ data });
      }
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setShowForm(false);
      toast({ title: editId ? "Product updated" : "Product created" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: "Product deleted" });
    } catch { toast({ title: "Error", variant: "destructive" }); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button size="sm" onClick={openCreate}>Add Product</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Price</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products?.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{p.name}</td>
                      <td className="py-3 px-4 font-bold text-primary">{formatUGX(p.price)}</td>
                      <td className="py-3 px-4 text-muted-foreground hidden md:table-cell">{p.category}</td>
                      <td className="py-3 px-4">{p.currentStock} <span className="text-muted-foreground text-xs">/ min {p.lowStockThreshold}</span></td>
                      <td className="py-3 px-4">
                        <Badge variant={p.isActive ? "outline" : "secondary"} className={p.isActive ? "text-green-700 border-green-300" : ""}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!products || products.length === 0) && <p className="text-sm text-muted-foreground text-center py-10">No products yet</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label>Product Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Price (UGX)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1" required />
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="mt-1" placeholder="piece, pack, kg..." />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Low Stock Alert Threshold</Label>
              <Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="active" checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label htmlFor="active">Active (visible on menu)</Label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {editId ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
