"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/components/ui";

const fmtRupee = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");

function ChartCard({ title, children, className }) {
  return (
    <Box className={cn("animate-rise glass", className)} sx={{ borderRadius: 4, p: 2.5, boxShadow: "0 12px 32px -14px rgba(15,23,42,0.05)" }}>
      <Typography component="h3" sx={{ mb: 2, fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>{title}</Typography>
      {children}
    </Box>
  );
}

// Monthly fuel spend area chart. data = [{month, fuel, trips, shortageL}] (desc) -> shown asc.
export function SpendAreaChart({ data = [] }) {
  const rows = [...data].reverse().map((m) => ({ month: (m.month || "").slice(5), fuel: m.fuel || 0, trips: m.trips || 0 }));
  return (
    <ChartCard title="Fuel spend by month">
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <AreaChart data={rows} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="gFuel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
            <Tooltip formatter={(v) => fmtRupee(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(0,0,0,.08)" }} />
            <Area type="monotone" dataKey="fuel" stroke="#4f46e5" strokeWidth={2.5} fill="url(#gFuel)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// Spend breakdown donut. totals = { fuel, maintenance, salaries, expenses }
export function SpendDonut({ totals = {} }) {
  const data = [
    { name: "Diesel", value: totals.fuel || 0, color: "#4f46e5" },
    { name: "Tolls", value: totals.fastag || 0, color: "#8b5cf6" },
    { name: "Extra oil", value: totals.extraOilCost || 0, color: "#fb7185" },
    { name: "Meal allowance", value: totals.mealAllowance || 0, color: "#0ea5e9" },
    { name: "Maintenance", value: totals.maintenance || 0, color: "#f59e0b" },
    { name: "Salaries", value: totals.salaries || 0, color: "#10b981" },
    { name: "Expenses", value: totals.expenses || 0, color: "#06b6d4" },
  ].filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title="Spend breakdown">
      {total === 0 ? (
        <Box sx={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "text.disabled" }}>No spend recorded yet</Box>
      ) : (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtRupee(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
