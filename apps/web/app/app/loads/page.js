"use client";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { useApi } from "@/lib/useApi";
import { Card, Table, Td, Tr, Badge, rupee, IconButton, useConfirm } from "@/components/ui";
import Box from "@mui/material/Box";
import { Trash2, Fuel } from "@/components/icons";

export default function Loads() {
  const { activeId, activeCompany = "all" } = useApp();
  const { data: loadsData, mutate: mutateLoads } = useApi(activeId ? `/api/loads?transportId=${activeId}&company=${activeCompany}` : null);
  const { data: driversData } = useApi(activeId ? `/api/members?transportId=${activeId}&role=driver` : null);
  const loads = loadsData?.loads || [];
  const drivers = driversData?.members || [];
  const { confirm, ConfirmModal } = useConfirm();

  async function remove(id) {
    if (!(await confirm({ title: "Delete load?", message: "This removes the load record.", confirmLabel: "Delete", danger: true }))) return;
    await api(`/api/loads/${id}`, { method: "DELETE" }); mutateLoads();
  }
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";

  if (!activeId) return <Card>Select or create a transport first.</Card>;

  return (
    <Box>
      <Table head={["Date", "Invoice", "Shipment", "Company", "From → To", "Driver", "Load (L)", "Oil (L)", "Shortage", ""]}>
        {loads.map((l) => (
          <Tr key={l.id}>
            <Td>{new Date(l.loadDate).toLocaleDateString("en-IN")}</Td>
            <Td sx={{ fontWeight: 500, color: "text.primary" }}>{l.invoiceNumber || "—"}</Td>
            <Td sx={{ color: "text.secondary" }}>{l.shipmentNo || "—"}</Td>
            <Td>{l.company ? l.company.toUpperCase() : "—"}</Td>
            <Td>{l.fromLocation || "—"} → {l.toLocation || "—"}</Td>
            <Td>{driverName(l.driverId)}</Td>
            <Td>{l.loadQtyL}</Td>
            <Td>{l.shipmentLead
              ? <Box component="span" title={`Diesel for the whole shipment (farthest ${l.shipmentMaxRtkm || l.rtkm} km ÷ ${l.averageKmL} km/L)`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600, color: "#2563eb" }}><Fuel size={14} />{l.shipmentOilLiters || 0}</Box>
              : <Box component="span" sx={{ color: "text.disabled", fontSize: 13 }}>shared</Box>}</Td>
            <Td>{l.shortageL ? <Badge tone="red">{l.shortageL} L</Badge> : "0"}</Td>
            <Td><Box sx={{ display: "flex", justifyContent: "flex-end" }}><IconButton Icon={Trash2} label="Delete" tone="rose" onClick={() => remove(l.id)} /></Box></Td>
          </Tr>
        ))}
        {loads.length === 0 && <Tr><Td sx={{ color: "text.disabled" }}>No loads yet. Upload an invoice to start.</Td></Tr>}
      </Table>
      {ConfirmModal}
    </Box>
  );
}
