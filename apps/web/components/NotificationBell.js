"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import { useApp } from "@/lib/appContext";
import { api } from "@/lib/clientApi";
import { enableWebPush, pushSupported } from "@/lib/webpush";
import { Bell, FileText, FileSpreadsheet, Landmark, CheckCircle2 } from "@/components/icons";

const KIND = {
  gmail: { Icon: Bell, color: "#7c3aed" },
  invoice: { Icon: FileText, color: "#2563eb" },
  freight: { Icon: FileSpreadsheet, color: "#059669" },
  payment: { Icon: Landmark, color: "#2563eb" },
  info: { Icon: Bell, color: "#64748b" },
};

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString("en-IN");
}

export default function NotificationBell() {
  const { me, activeId } = useApp();
  const router = useRouter();
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [anchor, setAnchor] = useState(null);
  const [pushMsg, setPushMsg] = useState("");
  const [pushOn, setPushOn] = useState(false);
  const checkedFor = useRef(null);

  useEffect(() => { setPushOn(typeof Notification !== "undefined" && Notification.permission === "granted"); }, []);
  async function enablePush() {
    setPushMsg("");
    try { await enableWebPush(activeId); setPushOn(true); setPushMsg("Browser notifications on ✓"); }
    catch (e) { setPushMsg(String(e.message || e)); }
  }

  const reload = async () => {
    if (!activeId) return;
    try { setData(await api(`/api/notifications?transportId=${activeId}`)); } catch {}
  };

  // Poll for new notifications; also ask the server to scan Gmail once per transport on open.
  useEffect(() => {
    if (!activeId || (me?.role !== "owner" && me?.role !== "manager")) return;
    if (checkedFor.current !== activeId) {
      checkedFor.current = activeId;
      api(`/api/notifications/check`, { method: "POST", body: { transportId: activeId } }).catch(() => {}).finally(reload);
    } else { reload(); }
    const t = setInterval(reload, 45000);
    return () => clearInterval(t);
  }, [activeId, me]);

  if (!me || (me.role !== "owner" && me.role !== "manager")) return null;

  async function open(e) {
    setAnchor(e.currentTarget);
    if (data.unread > 0) {
      await api(`/api/notifications/read`, { method: "POST", body: { transportId: activeId } }).catch(() => {});
      setData((d) => ({ ...d, unread: 0, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
    }
  }
  function go(n) { setAnchor(null); if (n.link) router.push(n.link); }

  return (
    <>
      <IconButton onClick={open} title="Notifications" sx={{ borderRadius: 3, bgcolor: "rgba(255,255,255,0.6)", p: 1, color: "text.secondary", "&:hover": { bgcolor: "rgba(255,255,255,0.9)" } }}>
        <Badge badgeContent={data.unread} color="error" overlap="circular" sx={{ "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16 } }}>
          <Bell size={18} />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 340, maxHeight: 440, borderRadius: 3, mt: 0.5 } } }}>
        <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Box component="span" sx={{ fontWeight: 700, fontSize: 14, color: "text.primary" }}>Notifications</Box>
          {pushSupported() && !pushOn && (
            <Box component="button" onClick={enablePush}
              sx={{ cursor: "pointer", border: 0, borderRadius: 2, px: 1, py: 0.5, fontSize: 11.5, fontWeight: 700, color: "#fff", backgroundImage: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
              Enable push
            </Box>
          )}
          {pushOn && <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: "success.main" }}>Push on ✓</Box>}
        </Box>
        {pushMsg && <Box sx={{ px: 2, py: 0.75, fontSize: 11.5, color: "text.secondary", borderBottom: "1px solid", borderColor: "rgba(15,23,42,0.05)" }}>{pushMsg}</Box>}
        {data.notifications.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: "center", color: "text.disabled", fontSize: 14 }}>
            <CheckCircle2 size={28} /><Typography sx={{ mt: 1, fontSize: 14 }}>You&apos;re all caught up</Typography>
          </Box>
        ) : data.notifications.map((n) => {
          const k = KIND[n.type] || KIND.info;
          return (
            <Box key={n.id} onClick={() => go(n)}
              sx={{ display: "flex", gap: 1.25, px: 2, py: 1.25, cursor: n.link ? "pointer" : "default", borderBottom: "1px solid", borderColor: "rgba(15,23,42,0.05)", "&:hover": { bgcolor: "rgba(15,23,42,0.03)" } }}>
              <Box sx={{ display: "flex", width: 32, height: 32, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: 2, color: "#fff", bgcolor: k.color }}>
                <k.Icon size={16} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "text.primary" }}>{n.title}</Typography>
                {n.body ? <Typography sx={{ fontSize: 12.5, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</Typography> : null}
                <Typography sx={{ fontSize: 11, color: "text.disabled", mt: 0.25 }}>{timeAgo(n.createdAt)}</Typography>
              </Box>
            </Box>
          );
        })}
      </Menu>
    </>
  );
}
