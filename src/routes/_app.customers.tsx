import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const filtered = data?.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(s) || c.email?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">Fichas de clientes registrados</p>
      </div>
      <Input placeholder="Buscar por nombre, teléfono o email" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr><th className="p-2 text-left">Nombre</th><th className="p-2 text-left">Teléfono</th><th className="p-2 text-left">Email</th><th className="p-2 text-left">Notas</th></tr>
            </thead>
            <tbody>
              {filtered?.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-2">{c.name ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{c.phone ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="p-2 text-muted-foreground text-xs">{c.notes ?? ""}</td>
                </tr>
              ))}
              {!filtered?.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Sin clientes.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
