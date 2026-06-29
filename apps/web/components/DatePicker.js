"use client";
// MUI X date pickers wrapped to keep the old string-in / string-out API.
import dayjs from "dayjs";
import { DatePicker as MuiDatePicker } from "@mui/x-date-pickers/DatePicker";

// value "yyyy-mm-dd" → onChange("yyyy-mm-dd")
export function DatePicker({ value, onChange, placeholder = "Select date", className }) {
  const val = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? dayjs(value) : null;
  return (
    <MuiDatePicker
      value={val}
      onChange={(d) => onChange(d && d.isValid() ? d.format("YYYY-MM-DD") : "")}
      format="DD MMM YYYY"
      className={className}
      slotProps={{ textField: { size: "small", fullWidth: true, placeholder } }}
    />
  );
}

// value "YYYY-MM" → onChange("YYYY-MM")
export function MonthPicker({ value, onChange, className }) {
  const val = value && /^\d{4}-\d{2}$/.test(value) ? dayjs(value + "-01") : null;
  return (
    <MuiDatePicker
      views={["year", "month"]}
      openTo="month"
      value={val}
      onChange={(d) => onChange(d && d.isValid() ? d.format("YYYY-MM") : "")}
      format="MMMM YYYY"
      className={className}
      slotProps={{ textField: { size: "small", fullWidth: true, placeholder: "Select month" } }}
    />
  );
}
