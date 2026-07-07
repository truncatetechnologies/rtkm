import { dbConnect } from "@/lib/mongoose";
import { User, Shortage, SalaryRecord, Leave, Load, toSalary, dayUTC } from "@/lib/models";

const fmtInvDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

function endOfPeriod(period) {
  // period = "YYYY-MM" -> last instant of that month (UTC, matching how dates are stored)
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)); // day 0 of next month = last day of this month
}
function startOfPeriod(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
}

// Pro-rate a driver's monthly salary for one month, accounting for a mid-month joining date and
// unpaid leave days. Per-day rate uses the ACTUAL number of days in that month (28–31).
//   perDay      = monthlySalary / daysInMonth
//   employedDays = days from max(month start, joiningDate) to month end (full month if joined earlier)
//   payableDays  = employedDays − unpaid leave days that fall inside the employment window
//   base paid    = round(perDay × payableDays)
async function proratedBase({ driver, period }) {
  const [y, m] = period.split("-").map(Number);
  const monthStart = Date.UTC(y, m - 1, 1);
  const monthEnd = Date.UTC(y, m, 0); // last day-of-month (midnight UTC)
  const daysInMonth = Math.round((monthEnd - monthStart) / 86400000) + 1;
  const monthlySalary = driver.baseSalary || 0;

  // Employment window inside this month. A joining date in a later month → nothing payable.
  const joinDay = driver.joiningDate ? dayUTC(driver.joiningDate) : monthStart;
  const employStart = Math.max(monthStart, joinDay);
  const employedDays = joinDay > monthEnd ? 0 : Math.round((monthEnd - employStart) / 86400000) + 1;

  // Unpaid leaves overlapping this month, clamped to the employment window.
  const leaves = await Leave.find({
    driverId: driver._id, paid: false,
    fromDate: { $lte: endOfPeriod(period) }, toDate: { $gte: startOfPeriod(period) },
  });
  let leaveDays = 0;
  for (const lv of leaves) {
    const lo = Math.max(employStart, dayUTC(lv.fromDate));
    const hi = Math.min(monthEnd, dayUTC(lv.toDate));
    if (hi >= lo) leaveDays += Math.round((hi - lo) / 86400000) + 1;
  }
  leaveDays = Math.min(leaveDays, employedDays); // can't lose more than the days worked

  const payableDays = Math.max(0, employedDays - leaveDays);
  const perDay = daysInMonth > 0 ? monthlySalary / daysInMonth : 0;
  const base = Math.round(perDay * payableDays);
  return { monthlySalary, daysInMonth, employedDays, leaveDays, payableDays, base };
}

// Generate (or regenerate) a driver's payslip for a month, applying open shortages as deductions.
export async function generatePayslip({ ownerId, transportId, driverId, period, additions = [] }) {
  await dbConnect();
  if (!/^\d{4}-\d{2}$/.test(period || "")) throw new Error("period must be YYYY-MM");

  const driver = await User.findOne({ _id: driverId, role: "driver" });
  if (!driver) throw new Error("Driver not found");

  let slip = await SalaryRecord.findOne({ driverId, period });
  if (slip && slip.status === "paid") throw new Error("Payslip already paid for this period");

  // If regenerating a draft, release its previously-deducted shortages first.
  if (slip) {
    await Shortage.updateMany({ payslipId: slip._id }, { status: "open", payslipId: null });
  }

  // Shortages to deduct: open, reported on/before this period's end — but NOT from before the driver
  // joined, nor before the last PAID payslip. This stops an old/un-deducted backlog (e.g. shortages
  // from loads dated before this driver's joining date) from dumping into a later month's payslip.
  const cutoff = endOfPeriod(period);
  const lastPaid = await SalaryRecord.findOne({ driverId, status: "paid", period: { $lt: period } }).sort({ period: -1 });
  const lowerMs = Math.max(
    driver.joiningDate ? dayUTC(driver.joiningDate) : -Infinity,
    lastPaid ? endOfPeriod(lastPaid.period).getTime() + 1 : -Infinity
  );
  const reportedAt = { $lte: cutoff };
  if (Number.isFinite(lowerMs)) reportedAt.$gte = new Date(lowerMs);
  const shortages = await Shortage.find({ driverId, status: "open", reportedAt });

  // Look up each shortage's invoice date from its load so the breakdown shows date + invoice no.
  const invNos = [...new Set(shortages.map((s) => s.invoiceNumber).filter(Boolean))];
  const loadDocs = invNos.length ? await Load.find({ transportId, invoiceNumber: { $in: invNos } }).select("invoiceNumber invoiceDate") : [];
  const dateByInv = {};
  loadDocs.forEach((l) => { if (l.invoiceNumber && l.invoiceDate && !dateByInv[l.invoiceNumber]) dateByInv[l.invoiceNumber] = l.invoiceDate; });

  const deductions = shortages.map((s) => {
    const dt = fmtInvDate(dateByInv[s.invoiceNumber]);
    return {
      reason: `Oil shortage (inv ${s.invoiceNumber || "?"}${dt ? ` · ${dt}` : ""}, ${s.shortageL}L)`,
      amount: s.shortageValue || s.shortageL * (s.ratePerUnit || 0),
      shortageId: s._id,
    };
  });
  const addList = (additions || []).map((a) => ({ reason: a.reason || "Addition", amount: Number(a.amount) || 0 }));

  // Pro-rate the base for joining date + unpaid leave; that prorated amount feeds net pay.
  const pr = await proratedBase({ driver, period });
  const baseSalary = pr.base;
  const totalDed = deductions.reduce((s, d) => s + (d.amount || 0), 0);
  const totalAdd = addList.reduce((s, a) => s + (a.amount || 0), 0);
  const netPay = baseSalary + totalAdd - totalDed;

  if (!slip) slip = new SalaryRecord({ ownerId, transportId, driverId, period });
  slip.baseSalary = baseSalary;
  slip.monthlySalary = pr.monthlySalary;
  slip.daysInMonth = pr.daysInMonth;
  slip.payableDays = pr.payableDays;
  slip.leaveDays = pr.leaveDays;
  slip.additions = addList;
  slip.deductions = deductions;
  slip.netPay = netPay;
  slip.status = "draft";
  slip.generatedAt = new Date();
  await slip.save();

  // Link shortages to this payslip and mark deducted.
  if (shortages.length) {
    await Shortage.updateMany(
      { _id: { $in: shortages.map((s) => s._id) } },
      { status: "deducted", payslipId: slip._id }
    );
  }
  return toSalary(slip);
}

// Discard a DRAFT payslip: release its deducted shortages back to "open" and delete the slip.
// Paid payslips cannot be discarded.
export async function discardPayslip(slip) {
  await dbConnect();
  if (slip.status === "paid") return { error: "Paid payslips can't be discarded." };
  await Shortage.updateMany({ payslipId: slip._id }, { status: "open", payslipId: null });
  await slip.deleteOne();
  return { ok: true };
}
