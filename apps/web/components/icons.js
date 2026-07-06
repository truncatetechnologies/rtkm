"use client";
// MUI icon set re-exported under the names the app already uses (formerly lucide-react),
// wrapped so the existing `size={N}` / `color="#hex"` props keep working. No third-party icon lib.
import { forwardRef } from "react";
import WarningAmber from "@mui/icons-material/WarningAmber";
import NotificationsNone from "@mui/icons-material/NotificationsNone";
import TollMui from "@mui/icons-material/Toll";
import WarehouseMui from "@mui/icons-material/Warehouse";
import NotificationsActiveMui from "@mui/icons-material/NotificationsActive";
import Block from "@mui/icons-material/Block";
import BarChart from "@mui/icons-material/BarChart";
import Business from "@mui/icons-material/Business";
import Calculate from "@mui/icons-material/Calculate";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import CheckCircle from "@mui/icons-material/CheckCircle";
import CheckBox from "@mui/icons-material/CheckBox";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import ChevronRightMui from "@mui/icons-material/ChevronRight";
import KeyboardDoubleArrowLeft from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRight from "@mui/icons-material/KeyboardDoubleArrowRight";
import AccessTime from "@mui/icons-material/AccessTime";
import TableChart from "@mui/icons-material/TableChart";
import Description from "@mui/icons-material/Description";
import ReportProblem from "@mui/icons-material/ReportProblem";
import LocalGasStation from "@mui/icons-material/LocalGasStation";
import Speed from "@mui/icons-material/Speed";
import HistoryMui from "@mui/icons-material/History";
import CurrencyRupee from "@mui/icons-material/CurrencyRupee";
import AccountBalance from "@mui/icons-material/AccountBalance";
import SpaceDashboard from "@mui/icons-material/SpaceDashboard";
import LinkOff from "@mui/icons-material/LinkOff";
import LockMui from "@mui/icons-material/Lock";
import Logout from "@mui/icons-material/Logout";
import LoginIcon from "@mui/icons-material/Login";
import Email from "@mui/icons-material/Email";
import LocationOn from "@mui/icons-material/LocationOn";
import NavigationMui from "@mui/icons-material/Navigation";
import Inventory2 from "@mui/icons-material/Inventory2";
import Edit from "@mui/icons-material/Edit";
import PhoneMui from "@mui/icons-material/Phone";
import Power from "@mui/icons-material/Power";
import Add from "@mui/icons-material/Add";
import Balance from "@mui/icons-material/Balance";
import SearchMui from "@mui/icons-material/Search";
import SettingsMui from "@mui/icons-material/Settings";
import VerifiedUser from "@mui/icons-material/VerifiedUser";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import DeleteOutline from "@mui/icons-material/DeleteOutlined";
import TrendingDownMui from "@mui/icons-material/TrendingDown";
import LocalShipping from "@mui/icons-material/LocalShipping";
import Undo from "@mui/icons-material/Undo";
import FileUpload from "@mui/icons-material/FileUpload";
import CloudUpload from "@mui/icons-material/CloudUpload";
import Person from "@mui/icons-material/Person";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import Group from "@mui/icons-material/Group";
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import Build from "@mui/icons-material/Build";
import Close from "@mui/icons-material/Close";

// Wrap a MUI icon so `size` (px) maps to fontSize and `color` (any CSS color) maps to sx.
function ic(MuiIcon) {
  return forwardRef(function Icon({ size = 20, color, sx, ...rest }, ref) {
    return (
      <MuiIcon
        ref={ref}
        sx={[{ fontSize: typeof size === "number" ? `${size}px` : size, ...(color ? { color } : {}) }, ...(Array.isArray(sx) ? sx : [sx])]}
        {...rest}
      />
    );
  });
}

export const AlertTriangle = ic(WarningAmber);
export const Bell = ic(NotificationsNone);
export const Toll = ic(TollMui);
export const Warehouse = ic(WarehouseMui);
export const AlertBell = ic(NotificationsActiveMui);
export const Ban = ic(Block);
export const BarChart3 = ic(BarChart);
export const Building2 = ic(Business);
export const Calculator = ic(Calculate);
export const CalendarDays = ic(CalendarMonth);
export const CheckCircle2 = ic(CheckCircle);
export const CheckSquare = ic(CheckBox);
export const ChevronDown = ic(KeyboardArrowDown);
export const ChevronRight = ic(ChevronRightMui);
export const ChevronsLeft = ic(KeyboardDoubleArrowLeft);
export const ChevronsRight = ic(KeyboardDoubleArrowRight);
export const Clock = ic(AccessTime);
export const FileSpreadsheet = ic(TableChart);
export const FileText = ic(Description);
export const FileWarning = ic(ReportProblem);
export const Fuel = ic(LocalGasStation);
export const Gauge = ic(Speed);
export const History = ic(HistoryMui);
export const IndianRupee = ic(CurrencyRupee);
export const Landmark = ic(AccountBalance);
export const LayoutDashboard = ic(SpaceDashboard);
export const Link2Off = ic(LinkOff);
export const Lock = ic(LockMui);
export const LogOut = ic(Logout);
export const LogIn = ic(LoginIcon);
export const Mail = ic(Email);
export const MapPin = ic(LocationOn);
export const Navigation2 = ic(NavigationMui);
export const Package = ic(Inventory2);
export const Pencil = ic(Edit);
export const Phone = ic(PhoneMui);
export const Plug = ic(Power);
export const Plus = ic(Add);
export const Scale = ic(Balance);
export const Search = ic(SearchMui);
export const Settings = ic(SettingsMui);
export const ShieldCheck = ic(VerifiedUser);
export const Sparkles = ic(AutoAwesome);
export const Trash2 = ic(DeleteOutline);
export const TrendingDown = ic(TrendingDownMui);
export const Truck = ic(LocalShipping);
export const Undo2 = ic(Undo);
export const Upload = ic(FileUpload);
export const UploadCloud = ic(CloudUpload);
export const User = ic(Person);
export const UserCog = ic(ManageAccounts);
export const Users = ic(Group);
export const Wallet = ic(AccountBalanceWallet);
export const Wrench = ic(Build);
export const X = ic(Close);
