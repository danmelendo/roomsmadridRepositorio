import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useRateGroups, useDynamicRules, eur, DURATION_LABELS } from "@/lib/data";
import { useRoles } from "@/lib/roles";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

type DynamicRuleFormType = "occupancy" | "date";
type DynamicRuleConfig = {
  threshold?: number;
  from?: string;
  to?: string;
  weekdays?: number[];
  timeFrom?: string;
  timeTo?: string;
  windows?: { weekday: number; from: string; to: string }[];
};

const WEEKDAYS = [
  { value: 1, label: "L" },
  { value: 2, label: "M" },
  { value: 3, label: "X" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

function describeDateRuleConfig(cfg: DynamicRuleConfig) {
  if (cfg.windows?.length) {
    return cfg.windows.map((w) => {
      const day = WEEKDAYS.find((d) => d.value === w.weekday)?.label ?? String(w.weekday);
      return `${day} ${w.from}-${w.to}`;
    }).join(", ");
  }
  const parts: string[] = [];
  if (cfg.from || cfg.to) parts.push(`${cfg.from || "..."} -> ${cfg.to || "..."}`);
  if (cfg.weekdays?.length) {
    parts.push(cfg.weekdays.map((w) => WEEKDAYS.find((d) => d.value === w)?.label ?? String(w)).join(","));
  }
  const from = cfg.timeFrom ?? "00:00";
  const to = cfg.timeTo ?? "24:00";
  if (from !== "00:00" || to !== "24:00") parts.push(`${from}-${to}`);
  else parts.push("Todo el dia");
  return parts.join(" · ");
}

export const Route = createFileRoute("/_app/rates")({
  component: RatesPage,
});

function RatesPage() {
  const { isAdmin, loading: rolesLoading } = useRoles();
  const { data: groups } = useRateGroups();
  const [groupId, setGroupId] = useState<string>("");

  if (rolesLoading) return null;
  if (!isAdmin) return <Navigate to="/today" />;

  const currentGroup = groups?.find((g) => g.id === groupId) ?? groups?.[0];
  const effectiveId = currentGroup?.id ?? "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarifas</h1>
        <p className="text-sm text-muted-foreground">Tablas base, noche completa y reglas dinámicas</p>
      </div>

      <Tabs defaultValue="hourly">
        <TabsList>
          <TabsTrigger value="hourly">Por horas</TabsTrigger>
          <TabsTrigger value="overnight">Noche completa</TabsTrigger>
          <TabsTrigger value="third">3ª persona</TabsTrigger>
          <TabsTrigger value="dynamic">Dinámicas</TabsTrigger>
        </TabsList>

        <TabsContent value="hourly" className="space-y-3">
          <Select value={effectiveId} onValueChange={setGroupId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Grupo de tarifa" /></SelectTrigger>
            <SelectContent>{groups?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          {effectiveId && <HourlyTable groupId={effectiveId} />}
        </TabsContent>

        <TabsContent value="overnight" className="space-y-3">
          <Select value={effectiveId} onValueChange={setGroupId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Grupo de tarifa" /></SelectTrigger>
            <SelectContent>{groups?.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
          {effectiveId && <OvernightTable groupId={effectiveId} />}
        </TabsContent>

        <TabsContent value="third"><ThirdPersonTable /></TabsContent>
        <TabsContent value="dynamic"><DynamicRulesPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function HourlyTable({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["rate_hourly", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_hourly").select("*").eq("rate_group_id", groupId).order("duration_min");
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "price_with_jacuzzi" | "price_without_jacuzzi"; value: number | null }) => {
      const patch = field === "price_with_jacuzzi" ? { price_with_jacuzzi: value } : { price_without_jacuzzi: value };
      const { error } = await supabase.from("rate_hourly").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate_hourly", groupId] }),
  });
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr><th className="p-2 text-left">Duración</th><th className="p-2 text-right">Con jacuzzi</th><th className="p-2 text-right">Sin jacuzzi</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2">{DURATION_LABELS[r.duration_min]}</td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.price_with_jacuzzi ?? ""} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, field: "price_with_jacuzzi", value: e.target.value ? Number(e.target.value) : null })} />
                </td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.price_without_jacuzzi ?? ""} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, field: "price_without_jacuzzi", value: e.target.value ? Number(e.target.value) : null })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function OvernightTable({ groupId }: { groupId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["rate_overnight", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_overnight").select("*").eq("rate_group_id", groupId).order("checkout_time");
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("rate_overnight").update({ price: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate_overnight", groupId] }),
  });
  if (!data?.length) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Este grupo no tiene tarifa de noche completa.</CardContent></Card>;
  }
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr><th className="p-2 text-left">Hora salida</th><th className="p-2 text-right">Precio</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2 font-mono">{r.checkout_time.slice(0, 5)}</td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.price} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, value: Number(e.target.value) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ThirdPersonTable() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["rate_third"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rate_third_person").select("*").order("duration_min");
      if (error) throw error;
      return data;
    },
  });
  const update = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase.from("rate_third_person").update({ surcharge: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rate_third"] }),
  });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Suplemento por persona adicional</CardTitle><CardDescription>Se aplica desde la 3ª persona, por persona y por tramo horario.</CardDescription></CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr><th className="p-2 text-left">Duración</th><th className="p-2 text-right">Suplemento</th></tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2">{DURATION_LABELS[r.duration_min]}</td>
                <td className="p-2 text-right">
                  <Input type="number" defaultValue={r.surcharge} className="h-8 text-right tabular-nums max-w-[100px] ml-auto"
                    onBlur={(e) => update.mutate({ id: r.id, value: Number(e.target.value) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// "weekday" is a UI-only form mode that saves as type="date" without date range
type FormType = "occupancy" | "date" | "weekday";

function badgeLabel(r: { type: string; config: unknown }) {
  if (r.type === "occupancy") return "Ocupación";
  const cfg = r.config as DynamicRuleConfig;
  if (!cfg.from && !cfg.to && cfg.weekdays?.length) return "Semanal";
  return "Fecha";
}

function DynamicRulesPanel() {
  const qc = useQueryClient();
  const { data } = useDynamicRules();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formType, setFormType] = useState<FormType>("occupancy");
  const [name, setName] = useState("");
  const [multiplier, setMultiplier] = useState(15);
  const [threshold, setThreshold] = useState(70);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [timeFrom, setTimeFrom] = useState("00:00");
  const [timeTo, setTimeTo] = useState("24:00");

  function resetForm() {
    setEditId(null);
    setFormType("occupancy");
    setName("");
    setMultiplier(15);
    setThreshold(70);
    setFrom("");
    setTo("");
    setWeekdays([]);
    setTimeFrom("00:00");
    setTimeTo("24:00");
  }

  function openEdit(r: { id: string; type: string; name: string; multiplier: number; config: unknown }) {
    const cfg = r.config as DynamicRuleConfig;
    setEditId(r.id);
    setName(r.name);
    setMultiplier(r.multiplier);
    setThreshold(cfg.threshold ?? 70);
    setFrom(cfg.from ?? "");
    setTo(cfg.to ?? "");
    setWeekdays(cfg.weekdays ?? []);
    setTimeFrom(cfg.timeFrom ?? "00:00");
    setTimeTo(cfg.timeTo ?? "24:00");
    if (r.type === "occupancy") {
      setFormType("occupancy");
    } else if (!cfg.from && !cfg.to && cfg.weekdays?.length) {
      setFormType("weekday");
    } else {
      setFormType("date");
    }
    setOpen(true);
  }

  function buildConfig(): DynamicRuleConfig {
    if (formType === "occupancy") return { threshold };
    if (formType === "weekday") {
      return { weekdays, timeFrom, timeTo };
    }
    return {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(weekdays.length ? { weekdays } : {}),
      timeFrom,
      timeTo,
    };
  }

  const dbType = formType === "occupancy" ? "occupancy" : "date";

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dynamic_rules").insert({
        type: dbType, name, multiplier, config: buildConfig() as never, active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic_rules"] });
      setOpen(false);
      resetForm();
      toast.success("Regla creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("dynamic_rules")
        .update({ type: dbType, name, multiplier, config: buildConfig() as never })
        .eq("id", editId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamic_rules"] });
      setOpen(false);
      resetForm();
      toast.success("Regla guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("dynamic_rules").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic_rules"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dynamic_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dynamic_rules"] }),
  });

  const WeekdayPicker = () => (
    <div className="flex flex-wrap gap-3">
      {WEEKDAYS.map((day) => (
        <label key={day.value} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={weekdays.includes(day.value)}
            onCheckedChange={(checked) => {
              setWeekdays((current) =>
                checked
                  ? Array.from(new Set([...current, day.value]))
                  : current.filter((value) => value !== day.value),
              );
            }}
          />
          {day.label}
        </label>
      ))}
    </div>
  );

  const timeFromOptions = Array.from({ length: 24 * 4 }, (_, i) => {
    const hh = String(Math.floor(i / 4)).padStart(2, "0");
    const mm = String((i % 4) * 15).padStart(2, "0");
    return `${hh}:${mm}`;
  });
  const timeToOptions = [
    ...Array.from({ length: 24 * 4 - 1 }, (_, i) => {
      const total = (i + 1) * 15;
      const hh = String(Math.floor(total / 60)).padStart(2, "0");
      const mm = String(total % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    }),
    "24:00",
  ];

  const TimePicker = () => (
    <div className="space-y-1.5">
      <Label>Tramo horario</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Select value={timeFrom} onValueChange={setTimeFrom}>
            <SelectTrigger><SelectValue placeholder="00:00" /></SelectTrigger>
            <SelectContent className="max-h-[40vh]">
              {timeFromOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Hasta</Label>
          <Select value={timeTo} onValueChange={setTimeTo}>
            <SelectTrigger><SelectValue placeholder="24:00" /></SelectTrigger>
            <SelectContent className="max-h-[40vh]">
              {timeToOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Todo el día: desde 00:00 hasta 24:00.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Las reglas se aplican sobre la tarifa base + suplementos. Las de fecha y ocupación se acumulan.
        </p>
        <Button onClick={() => { resetForm(); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Nueva regla</Button>
      </div>

      <div className="grid gap-2">
        {data?.map((r) => {
          const cfg = r.config as DynamicRuleConfig;
          return (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <Badge variant="outline">{badgeLabel(r)}</Badge>
                <div className="font-medium">{r.name}</div>
                <div className="text-sm text-muted-foreground">
                  {r.type === "occupancy" ? `>= ${cfg.threshold}% ocupacion` : describeDateRuleConfig(cfg)}
                </div>
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">+{r.multiplier}%</div>
                <div className="ml-auto flex items-center gap-2">
                  <Switch checked={r.active} onCheckedChange={(active) => toggle.mutate({ id: r.id, active })} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!data?.length && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Sin reglas. Crea la primera.</CardContent></Card>}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar regla dinámica" : "Nueva regla dinámica"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as FormType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="occupancy">Por ocupación</SelectItem>
                  <SelectItem value="weekday">Por día de la semana (indefinido)</SelectItem>
                  <SelectItem value="date">Por rango de fechas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Fin de semana, San Valentín" /></div>
            <div className="space-y-1.5"><Label>Recargo (%)</Label><Input type="number" value={multiplier} onChange={(e) => setMultiplier(Number(e.target.value))} /></div>

            {formType === "occupancy" && (
              <div className="space-y-1.5"><Label>Umbral de ocupación (%)</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></div>
            )}

            {formType === "weekday" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Días de la semana</Label>
                  <WeekdayPicker />
                  <p className="text-xs text-muted-foreground">La regla se activa cada semana en los días marcados, sin fecha de expiración.</p>
                </div>
                <TimePicker />
              </div>
            )}

            {formType === "date" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label>Desde (opcional)</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Hasta (opcional)</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Días de la semana (opcional)</Label>
                  <WeekdayPicker />
                  <p className="text-xs text-muted-foreground">Sin selección se aplica todos los días del rango.</p>
                </div>
                <TimePicker />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpen(false); }}>Cancelar</Button>
            <Button onClick={() => editId ? update.mutate() : create.mutate()} disabled={!name}>
              {editId ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

void eur;
