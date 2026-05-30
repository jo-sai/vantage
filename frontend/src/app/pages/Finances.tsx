import { useState, useEffect, useRef } from "react";
import { 
  Download, FileText, Filter, Search, RefreshCw, Receipt, 
  Clock, ShieldAlert, CheckCircle2, Lock, Unlock, Landmark, 
  Coins, FileSpreadsheet, FileCode, Check, Send, X, Plus, Edit3, UserPlus, Upload
} from "lucide-react";
import { useRole } from "../components/RoleContext";
import { useOrg } from "../components/OrgContext";
import { PermissionRequired } from "../components/PermissionRequired";
import { useCurrency } from "../components/CurrencyContext";
import { DataImportSheet } from "../components/DataImportSheet";
import { apiFetch } from "../data/api";
import { toast } from "sonner";

// --- Types ---
interface PayrollAdjustmentRow {
  id: string;
  employeeId: string;
  employeeName: string;
  team: string;
  workHours: number;
  overtimeHours: number;
  tardinessMinutes: number;
  bonus: number;
  baseRate: number;
  isSalaried: boolean;
  period: string;
  isLocked: boolean;
  updatedBy: string;
  updatedAt: string;
}

interface ExpenseLog {
  id: string;
  period: string;
  totalGrossPay: number;
  totalNetPay: number;
  employerTaxContribution: number;
  processingFees: number;
  bankLedgerDeducted: number;
  status: string;
  createdAt: string;
}

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  status: string;
  createdAt: string;
}

const hash = (str: string) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
};

export function Finances() {
  const { role } = useRole();
  const { activeOrg } = useOrg();
  const { format, meta, ratesUpdatedAt } = useCurrency();

  // Dynamically build active teams/departments
  const activeOrgDepartments = Array.from(
    new Set([
      ...(activeOrg?.members || []).map((m: any) => m.department),
      ...(() => {
        const saved = localStorage.getItem(`vantage_departments_${activeOrg?.id}`);
        if (saved) {
          try {
            return JSON.parse(saved).map((d: any) => d.name);
          } catch {}
        }
        return [];
      })()
    ])
  ).filter(Boolean) as string[];

  const allTeams = activeOrgDepartments.length > 0 ? activeOrgDepartments : ["Team Alpha", "Team Beta", "Team Gamma"];

  const isOwner = role === "Organization Owner";
  const isAdmin = role === "Organization Admin" || isOwner;
  const isTeamLeader = role === "Team Leader";
  const isFinanceAdmin = (role as string) === "Finance Admin";
  const isAuthorized = isAdmin || isFinanceAdmin;

  if (!isAuthorized) return <PermissionRequired pageName="Financial Management" />;

  // --- States ---
  const [period, setPeriod] = useState("May 2026");
  const [adjustments, setAdjustments] = useState<PayrollAdjustmentRow[]>([]);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  
  const empCsvInputRef = useRef<HTMLInputElement>(null);

  const handleEmpCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length < 2) {
          alert("CSV file must contain a header row and at least one data row.");
          return;
        }

        const parseCsvLine = (line: string): string[] => {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim().replace(/^"|"$/g, ''));
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim().replace(/^"|"$/g, ''));
          return result;
        };

        const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
        
        const emailIdx = headers.findIndex(h => h === "email" || h === "emailaddress");
        const nameIdx = headers.findIndex(h => h === "fullname" || h === "name" || h === "employee" || h === "employeename");
        const teamIdx = headers.findIndex(h => h === "team" || h === "department" || h === "dept" || h === "group");
        const rateIdx = headers.findIndex(h => h === "baserate" || h === "rate" || h === "payrate" || h === "salary");
        const typeIdx = headers.findIndex(h => h === "issalaried" || h === "salaried" || h === "type" || h === "contract" || h === "contracttype");

        if (emailIdx === -1 || nameIdx === -1) {
          alert("CSV file must at least contain 'FullName' (or 'Name') and 'Email' columns.");
          return;
        }

        const parsedEmployees = lines.slice(1).map((line) => {
          const cols = parseCsvLine(line);
          const email = cols[emailIdx] || "";
          const fullName = cols[nameIdx] || "";
          const team = teamIdx !== -1 ? (cols[teamIdx] || "Team Alpha") : "Team Alpha";
          
          let baseRate = 0.0;
          if (rateIdx !== -1 && cols[rateIdx]) {
            const val = parseFloat(cols[rateIdx].replace(/[^0-9.-]/g, ""));
            if (!isNaN(val)) baseRate = val;
          }

          let isSalaried = false;
          if (typeIdx !== -1 && cols[typeIdx]) {
            const val = cols[typeIdx].toLowerCase();
            isSalaried = val === "true" || val === "yes" || val === "y" || val === "salaried" || val === "salary";
          }

          return { email, fullName, team, baseRate, isSalaried };
        }).filter(emp => emp.email && emp.fullName);

        if (parsedEmployees.length === 0) {
          alert("No valid employee rows parsed from the CSV file.");
          return;
        }

        setImportText(JSON.stringify(parsedEmployees, null, 2));
      } catch (err) {
        alert("Failed to parse CSV file.");
      } finally {
        if (empCsvInputRef.current) empCsvInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Add Employee Form States
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [addEmpName, setAddEmpName] = useState("");
  const [addEmpEmail, setAddEmpEmail] = useState("");
  const [addEmpTeam, setAddEmpTeam] = useState(allTeams[0] || "Team Alpha");
  const [addEmpRate, setAddEmpRate] = useState("");
  const [addEmpIsSalaried, setAddEmpIsSalaried] = useState(false);

  // Edit Employee Form States
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState(false);
  const [selectedEditEmpId, setSelectedEditEmpId] = useState("");
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpTeam, setEditEmpTeam] = useState(allTeams[0] || "Team Alpha");
  const [editEmpRate, setEditEmpRate] = useState("");
  const [editEmpIsSalaried, setEditEmpIsSalaried] = useState(false);

  useEffect(() => {
    if (allTeams[0]) {
      setAddEmpTeam(allTeams[0]);
      setEditEmpTeam(allTeams[0]);
    }
  }, [activeOrg?.id]);

  const [expenseLogs, setExpenseLogs] = useState<ExpenseLog[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Ledger balances (State tracking for high-fidelity interactive sandbox experience)
  const [startingBalance, setStartingBalance] = useState(() => {
    const wsId = localStorage.getItem("vantage_active_workspace_id") || "default";
    const saved = localStorage.getItem(`vantage_bank_starting_balance_${wsId}`);
    return saved ? Number(saved) : 1250000;
  });
  const [bankBalance, setBankBalance] = useState(startingBalance); // dynamic cash balance
  const [pendingRemittance, setPendingRemittance] = useState(0.0);
  const [totalPaidNet, setTotalPaidNet] = useState(0);
  const [totalPaidGeneral, setTotalPaidGeneral] = useState(0);

  // Modals for Bank Ledger
  const [showEditBankModal, setShowEditBankModal] = useState(false);
  const [tempStartingBalance, setTempStartingBalance] = useState("");

  // Modals
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [batchFileResult, setBatchFileResult] = useState<any>(null);
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [locking, setLocking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Bank Payroll File Generator states
  const [showBankFileModal, setShowBankFileModal] = useState(false);
  const [bankFileFormat, setBankFileFormat] = useState<"CSV" | "TXT" | "JSON">("CSV");
  const [bankFileMemo, setBankFileMemo] = useState("Vantage Salary Batch Distribution");
  const [bankFileDate, setBankFileDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [compilingBankFile, setCompilingBankFile] = useState(false);

  const isPeriodLocked = adjustments.length > 0 && adjustments[0].isLocked;

  // --- API Integrations ---
  const getWsId = () => localStorage.getItem("vantage_active_workspace_id") || "default";

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      const wsId = getWsId();
      const savedBalance = localStorage.getItem(`vantage_bank_starting_balance_${wsId}`) || "1250000";
      const startingVal = Number(savedBalance);
      setStartingBalance(startingVal);

      if (isFinanceAdmin) {
        const summaryRes = await apiFetch("/finance/dashboard/summary");
        if (summaryRes && summaryRes.success) {
          setFinanceSummary(summaryRes.data);
        }
        setLoading(false);
        return;
      }

      // 1. Fetch adjustments (Only for Org Admins / Team Leaders)
      try {
        const adjRes = await apiFetch(`/finances/adjustments/${wsId}?period=${period}`);
        if (adjRes && adjRes.success && adjRes.data) {
          setAdjustments(adjRes.data);
        }
      } catch (err) {
        console.error("Failed to load payroll adjustments:", err);
      }

      // 2. Fetch general transactions
      let loadedTxs: TransactionRow[] = [];
      try {
        const txRes = await apiFetch(`/finances/transactions/${wsId}`);
        if (txRes && txRes.success && txRes.data) {
          setTransactions(txRes.data);
          loadedTxs = txRes.data;
        }
      } catch (err) {
        console.error("Failed to load general transactions:", err);
      }

      // 3. Fetch expense logs
      try {
        const expRes = await apiFetch(`/finances/expenses/${wsId}`);
        if (expRes && expRes.success && expRes.data) {
          setExpenseLogs(expRes.data);
          
          // Compute dynamically based on finalized logs
          const totalRemittedTaxes = expRes.data.reduce(
            (sum: number, log: ExpenseLog) => sum + (log.totalGrossPay * 0.16), 0 // 12% income tax + 4% SSS
          );
          const totalPaidNetVal = expRes.data.reduce(
            (sum: number, log: ExpenseLog) => sum + log.bankLedgerDeducted, 0
          );

          // Sum of all paid general transactions from import sheet
          const totalPaidGeneralVal = loadedTxs
            .filter((tx: TransactionRow) => tx.status === "Paid")
            .reduce((sum: number, tx: TransactionRow) => sum + tx.amount, 0);

          setPendingRemittance(totalRemittedTaxes);
          setTotalPaidNet(totalPaidNetVal);
          setTotalPaidGeneral(totalPaidGeneralVal);
          setBankBalance(startingVal - totalPaidNetVal - totalPaidGeneralVal);
        } else {
          setTotalPaidNet(0);
          setTotalPaidGeneral(0);
          setBankBalance(startingVal);
        }
      } catch (err) {
        console.error("Failed to load expense logs:", err);
        setTotalPaidNet(0);
        setTotalPaidGeneral(0);
        setBankBalance(startingVal);
      }
    } catch (e) {
      console.error("Failed to load payroll details from server context:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollData();
  }, [period]);

  useEffect(() => {
    if (!isAdmin) return;
    const ws = new WebSocket("ws://127.0.0.1:4000/ws/ingestion");
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "EMPLOYEE_IMPORT_SUCCESS") {
          loadPayrollData();
        }
      } catch (e) {}
    };
    return () => ws.close();
  }, [isAdmin]);

  const handleUpdateHours = (employeeId: string, field: "workHours" | "overtimeHours" | "tardinessMinutes" | "bonus", val: number) => {
    setAdjustments(prev => prev.map(adj => {
      if (adj.employeeId === employeeId) {
        return { ...adj, [field]: val };
      }
      return adj;
    }));
  };

  const handleSaveRow = async (row: PayrollAdjustmentRow) => {
    setSavingRows(prev => ({ ...prev, [row.employeeId]: true }));
    try {
      const wsId = getWsId();
      await apiFetch(`/finances/adjustments/${wsId}`, {
        method: "POST",
        body: {
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          team: row.team,
          workHours: row.workHours,
          overtimeHours: row.overtimeHours,
          tardinessMinutes: row.tardinessMinutes,
          bonus: row.bonus || 0.0,
          baseRate: row.baseRate,
          isSalaried: row.isSalaried,
          period: row.period
        }
      });
      setSuccessMsg(`Adjustments for ${row.employeeName} saved successfully.`);
      setTimeout(() => setSuccessMsg(""), 3000);
      loadPayrollData();
    } catch (e: any) {
      alert(`Modification failed: ${e.message}`);
    } finally {
      setSavingRows(prev => ({ ...prev, [row.employeeId]: false }));
    }
  };

  const handleLockAdjustments = async () => {
    setLocking(true);
    try {
      const wsId = getWsId();
      await apiFetch(`/finances/lock/${wsId}`, {
        method: "POST",
        body: { period }
      });
      setSuccessMsg("Adjustments cut-off locked successfully. Finalizing calculations.");
      setTimeout(() => setSuccessMsg(""), 3000);
      loadPayrollData();
    } catch (e: any) {
      alert(`Lock failed: ${e.message}`);
    } finally {
      setLocking(false);
    }
  };

  const handleDisbursePayroll = async () => {
    if (!isPeriodLocked) {
      alert("Please lock the payroll adjustments period before processing payouts.");
      return;
    }
    setProcessing(true);
    try {
      const wsId = getWsId();
      const res = await apiFetch(`/finances/process/${wsId}`, {
        method: "POST",
        body: { period, overtimeRateFactor: 1.5 }
      });
      if (res && res.success) {
        setBatchFileResult(res.bankBatchFile);
        setSuccessMsg(`Success! Payroll generated. Direct deposit batch generated.`);
        setTimeout(() => setSuccessMsg(""), 4000);
        loadPayrollData();
      }
    } catch (e: any) {
      alert(`Finalization failed: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleGenerateBankFileSubmit = async () => {
    setCompilingBankFile(true);
    try {
      const wsId = getWsId();
      const res = await apiFetch(`/finances/generate-bank-file/${wsId}`, {
        method: "POST",
        body: {
          period,
          fileFormat: bankFileFormat,
          memo: bankFileMemo,
          payrollDate: bankFileDate
        }
      });
      if (res && res.success) {
        toast.success("Bank File Compiled", {
          description: `Direct deposit batch file compiled successfully in ${bankFileFormat} format.`,
          style: { background: "var(--deep-slate)", border: "1px solid var(--mint-green)", color: "white" }
        });
        
        // Trigger direct browser download
        const element = document.createElement("a");
        const mimeType = bankFileFormat === "JSON" ? "application/json" : "text/plain";
        const file = new Blob([res.fileContent], { type: mimeType });
        element.href = URL.createObjectURL(file);
        element.download = res.fileName;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);

        setShowBankFileModal(false);
        setSuccessMsg(`Success! Generated bank payroll file: ${res.fileName}`);
        setTimeout(() => setSuccessMsg(""), 5000);
      }
    } catch (e: any) {
      alert(`Bank file compilation failed: ${e.message}`);
    } finally {
      setCompilingBankFile(false);
    }
  };

  const handleImportTransactions = async (importedRows: Array<{ date: string; description: string; category: string; amount: number; status: string }>) => {
    try {
      const wsId = getWsId();
      await apiFetch(`/finances/transactions/${wsId}`, {
        method: "POST",
        body: {
          transactions: importedRows
        }
      });
      setSuccessMsg(`Import successful: ${importedRows.length} transaction entries saved. Bank ledger recalculated.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      loadPayrollData(); // Reloads list & bank balance dynamically!
    } catch (e: any) {
      alert(`Transaction synchronization failed: ${e.message}`);
      throw e;
    }
  };

  const handleAddEmployeeSubmit = async () => {
    if (!addEmpName.trim() || !addEmpEmail.trim() || !addEmpRate) {
      alert("Please fill in all fields.");
      return;
    }
    setProcessing(true);
    try {
      const res = await apiFetch("/admin/import-employees", {
        method: "POST",
        body: {
          employees: [{
            email: addEmpEmail.trim().toLowerCase(),
            fullName: addEmpName.trim(),
            team: addEmpTeam,
            baseRate: parseFloat(addEmpRate as string) || 0.0,
            isSalaried: addEmpIsSalaried
          }]
        }
      });
      if (res && res.success) {
        setSuccessMsg(`Successfully added employee "${addEmpName.trim()}"!`);
        setTimeout(() => setSuccessMsg(""), 4000);
        setShowAddEmployeeModal(false);
        setAddEmpName("");
        setAddEmpEmail("");
        setAddEmpRate("");
        setAddEmpIsSalaried(false);
        loadPayrollData();
      }
    } catch (e: any) {
      alert(`Failed to add employee: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditEmployeeSubmit = async () => {
    if (!selectedEditEmpId) {
      alert("Please select an employee to edit.");
      return;
    }
    const currentEmp = adjustments.find(a => a.employeeId === selectedEditEmpId);
    if (!currentEmp) return;

    setProcessing(true);
    try {
      const wsId = getWsId();
      const res = await apiFetch(`/finances/adjustments/${wsId}`, {
        method: "POST",
        body: {
          employeeId: selectedEditEmpId,
          employeeName: editEmpName.trim() || currentEmp.employeeName,
          team: editEmpTeam || currentEmp.team,
          overtimeHours: currentEmp.overtimeHours,
          tardinessMinutes: currentEmp.tardinessMinutes,
          bonus: currentEmp.bonus || 0,
          baseRate: parseFloat(editEmpRate as string) || 0.0,
          isSalaried: editEmpIsSalaried,
          period: currentEmp.period
        }
      });
      if (res && res.success) {
        setSuccessMsg(`Successfully updated details for "${editEmpName.trim() || currentEmp.employeeName}"!`);
        setTimeout(() => setSuccessMsg(""), 4000);
        setShowEditEmployeeModal(false);
        setSelectedEditEmpId("");
        setEditEmpName("");
        setEditEmpRate("");
        loadPayrollData();
      }
    } catch (e: any) {
      alert(`Failed to update employee details: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectEmployeeToEdit = (empId: string) => {
    setSelectedEditEmpId(empId);
    const emp = adjustments.find(a => a.employeeId === empId);
    if (emp) {
      setEditEmpName(emp.employeeName);
      setEditEmpTeam(emp.team);
      setEditEmpRate(emp.baseRate.toString());
      setEditEmpIsSalaried(emp.isSalaried);
    } else {
      setEditEmpName("");
      setEditEmpTeam("Team Alpha");
      setEditEmpRate("");
      setEditEmpIsSalaried(false);
    }
  };

  // --- Dynamic Calculation Helpers for UI ---
  const calculateGrossPreview = (row: PayrollAdjustmentRow) => {
    const base_hours = 160.0;
    const work_hours = row.workHours || 160.0;
    const base_gross = row.isSalaried ? row.baseRate : (row.baseRate * work_hours);
    const hourly_rate = row.isSalaried ? (row.baseRate / base_hours) : row.baseRate;
    const ot_pay = row.overtimeHours * hourly_rate * 1.5;
    const tardiness_hours = row.tardinessMinutes / 60.0;
    const tardiness_penalty = tardiness_hours * hourly_rate;
    const bonus = row.bonus || 0.0;
    return Math.max(0.0, (base_gross + ot_pay) - tardiness_penalty + bonus);
  };

  const calculateNetPreview = (row: PayrollAdjustmentRow) => {
    const gross = calculateGrossPreview(row);
    if (gross <= 0) return 0;
    const statutory_tax = gross * 0.12;
    const statutory_insurance = gross * 0.04;
    const voluntary_retirement = gross * 0.02;
    const voluntary_insurance = gross > 100.0 ? 30.0 : 0.0;
    return Math.max(0.0, gross - (statutory_tax + statutory_insurance + voluntary_retirement + voluntary_insurance));
  };

  // --- Gatekeeping logic ---
  const canModifyRow = (row: PayrollAdjustmentRow) => {
    if (loading || locking || processing) return false;
    if (isPeriodLocked) return false;
    if (isAdmin) return true;
    if (isTeamLeader && row.team === "Team Alpha") return true;
    return false;
  };

  // --- Filters ---
  const filteredAdjustments = adjustments.filter(row => 
    row.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.team.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingTotal = adjustments.reduce((sum, row) => sum + calculateGrossPreview(row), 0);

  if (isFinanceAdmin) {
    return (
      <div className="h-full p-8 overflow-auto">
        <div className="max-w-[1800px] mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex justify-between items-center bg-white/[0.01] p-6 rounded-xl border border-[var(--glass-border)] backdrop-blur-md">
            <div>
              <h1 className="text-white mb-2 font-bold tracking-tight">Financial &amp; Budget Management Dashboard</h1>
              <p className="text-sm text-[var(--cool-gray)]">Monitor corporate allocations, paid general expenses, pending vendor invoices, and monthly operational balances.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-2 text-sm rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-[var(--mint-green)] font-mono font-bold animate-pulse">
                Reporting Period: Current Month ({period})
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-4 gap-6">
            <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-white/5 group-hover:text-amber-500/10 transition-colors pointer-events-none">
                <Landmark size={80} />
              </div>
              <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider mb-2">Total Allocated Budget</div>
              <div className="text-2xl font-bold text-white mb-1">
                {financeSummary ? format(financeSummary.totalAllocatedBudget) : format(1500000)}
              </div>
              <div className="text-[10px] text-amber-400">Total monthly corporate allowance</div>
            </div>

            <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-white/5 group-hover:text-[var(--mint-green)]/10 transition-colors pointer-events-none">
                <CheckCircle2 size={80} />
              </div>
              <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider mb-2">Actual Spent</div>
              <div className="text-2xl font-bold text-[var(--mint-green)] mb-1">
                {financeSummary ? format(financeSummary.actualSpent) : "₱0.00"}
              </div>
              <div className="text-[10px] text-[var(--cool-gray)]">Fully paid operating &amp; vendor expenses</div>
            </div>

            <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-white/5 group-hover:text-orange-500/10 transition-colors pointer-events-none">
                <Clock size={80} />
              </div>
              <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider mb-2">Pending Payments</div>
              <div className="text-2xl font-bold text-orange-400 mb-1">
                {financeSummary ? format(financeSummary.pendingPayments) : "₱0.00"}
              </div>
              <div className="text-[10px] text-[var(--cool-gray)]">Approved &amp; committed outstanding invoices</div>
            </div>

            <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-white/5 group-hover:text-[var(--action-blue)]/10 transition-colors pointer-events-none">
                <Coins size={80} />
              </div>
              <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider mb-2">Remaining Budget</div>
              <div className="text-2xl font-bold text-[var(--action-blue)] mb-1">
                {financeSummary ? format(financeSummary.remainingBudget) : format(1500000)}
              </div>
              <div className="text-[10px] text-[var(--mint-green)]">Left-over corporate margin balance</div>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] space-y-4">
            <h3 className="text-white font-bold tracking-tight">Ledger Breakdown &amp; Contribution Logs</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--glass-border)] bg-white/[0.01] text-xs text-[var(--cool-gray)]">
                    <th className="px-5 py-3 text-left font-semibold">Date</th>
                    <th className="px-5 py-3 text-left font-semibold">Description</th>
                    <th className="px-5 py-3 text-left font-semibold">Category</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                    <th className="px-5 py-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--glass-border)]/30 text-xs text-white">
                  {financeSummary && financeSummary.breakdown && financeSummary.breakdown.length > 0 ? (
                    financeSummary.breakdown.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 text-left font-mono text-[var(--cool-gray)]">{item.date}</td>
                        <td className="px-5 py-3.5 text-left font-semibold">{item.description}</td>
                        <td className="px-5 py-3.5 text-left">
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[var(--cool-gray)] text-[10px]">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold">{format(item.amount)}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.status === "Paid" || item.status === "paid"
                              ? "bg-[var(--mint-green)]/15 border-[var(--mint-green)]/35 text-[var(--mint-green)]"
                              : "bg-orange-500/15 border-orange-500/35 text-orange-400"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[var(--cool-gray)] italic">
                        No financial transactions or payroll logs found in the ledger.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-8 overflow-auto">
      <div className="max-w-[1800px] mx-auto space-y-8">

        {/* ── Page Header & Feedback Banner ── */}
        <div className="flex justify-between items-center bg-white/[0.01] p-6 rounded-xl border border-[var(--glass-border)] backdrop-blur-md">
          <div>
            <h1 className="text-white mb-2 font-bold tracking-tight">Financial &amp; Payroll Management</h1>
            <p className="text-sm text-[var(--cool-gray)]">Execute statutory payroll calculations, override overtime hours, issue direct deposits, and track expenses.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--cool-gray)]">Active Period:</span>
            <select 
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3.5 py-2 text-sm rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
            >
              <option value="May 2026">May 2026</option>
              <option value="June 2026">June 2026</option>
              <option value="July 2026">July 2026</option>
            </select>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-lg bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/35 text-[var(--mint-green)] text-xs font-semibold flex items-center gap-2 animate-pulse">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ── Summary & Ledger Widgets ── */}
        <div className="grid grid-cols-4 gap-6">
          <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-white/5 group-hover:text-[var(--action-blue)]/10 transition-colors pointer-events-none">
              <Landmark size={80} />
            </div>
            <div className="flex justify-between items-center mb-2">
              <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider">Company Bank Ledger</div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setTempStartingBalance(startingBalance.toString());
                    setShowEditBankModal(true);
                  }}
                  title="Configure starting balance baseline"
                  className="p-1 px-2.5 rounded bg-white/5 border border-white/10 hover:bg-[var(--action-blue)]/25 hover:text-white hover:border-[var(--action-blue)]/30 text-[var(--action-blue)] transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                >
                  <Edit3 size={11} />
                  <span>Configure</span>
                </button>
              )}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{format(bankBalance)}</div>
            <div className="text-[10px] text-[var(--mint-green)] flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--mint-green)] animate-ping" />
              <span>Cash Ledger Account Active</span>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-white/5 group-hover:text-purple-500/10 transition-colors pointer-events-none">
              <Coins size={80} />
            </div>
            <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider mb-2">Pending Remittance Liability</div>
            <div className="text-2xl font-bold text-purple-400 mb-1">{format(pendingRemittance)}</div>
            <div className="text-[10px] text-[var(--cool-gray)]">Taxes &amp; Escrows pending government transfer</div>
          </div>

          <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-white/5 group-hover:text-orange-500/10 transition-colors pointer-events-none">
              <Clock size={80} />
            </div>
            <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider mb-2">Active Gross Pay Estimate</div>
            <div className="text-2xl font-bold text-orange-400 mb-1">{format(pendingTotal)}</div>
            <div className="text-[10px] text-[var(--cool-gray)]">{filteredAdjustments.length} active employee payouts</div>
          </div>

          <div className="p-6 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-white/5 group-hover:text-amber-500/10 transition-colors pointer-events-none">
              <ShieldAlert size={80} />
            </div>
            <div className="text-xs text-[var(--cool-gray)] font-bold uppercase tracking-wider mb-2">Payroll Status</div>
            <div className="flex items-center gap-2 mt-1">
              {isPeriodLocked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 border border-orange-500/25 text-orange-400">
                  <Lock size={12} />
                  Locked for Processing
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/25 text-[var(--mint-green)]">
                  <Unlock size={12} />
                  Open for Adjustments
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--cool-gray)] mt-2">Lock overrides hours modification</div>
          </div>
        </div>

        {/* ── Global Operations Lock & Process (Org Admin Only) ── */}
        {isAdmin && (
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/20">
                <ShieldAlert size={18} />
              </div>
              <div>
                <span className="text-sm font-semibold text-white">Cut-off Period &amp; Batch Disbursement Control</span>
                <p className="text-[10px] text-[var(--cool-gray)]">Lock modifications, trigger batch statutory withholding engines, deduct company bank ledgers, and disburse paychecks.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/30 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/25 transition-colors flex items-center gap-1.5 cursor-pointer animate-pulse"
              >
                <Plus size={13} />
                <span>Import Employees</span>
              </button>

              <button
                onClick={() => setShowAddEmployeeModal(true)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/30 text-[var(--mint-green)] hover:bg-[var(--mint-green)]/25 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={13} />
                <span>Add Employee</span>
              </button>

              <button
                onClick={() => setShowEditEmployeeModal(true)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Edit Details</span>
              </button>

              <button
                onClick={handleLockAdjustments}
                disabled={locking || isPeriodLocked}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {locking ? <RefreshCw size={13} className="animate-spin" /> : <Lock size={13} />}
                <span>{isPeriodLocked ? "Adjustments Period Locked" : "Lock Adjustments Window"}</span>
              </button>

              <button
                onClick={handleDisbursePayroll}
                disabled={processing || !isPeriodLocked}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {processing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Disburse &amp; Finalize Payroll</span>
              </button>

              <button
                onClick={() => setShowBankFileModal(true)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Landmark size={13} />
                <span>Bank Payroll File</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Role-Based Payroll Adjustments Dashboard ── */}
        <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--glass-border)] bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <Clock size={16} className="text-[var(--action-blue)]" />
                Employee Adjustments Board ({period})
              </span>
              <p className="text-[10px] text-[var(--cool-gray)]">
                {isTeamLeader ? "Logged scope: Team Alpha members only" : "Logged scope: Global Corporate Ledger"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cool-gray)]" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search employees…"
                  className="h-8 pl-8 pr-4 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white placeholder:text-[var(--cool-gray)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--glass-border)] bg-white/[0.01] text-xs text-[var(--cool-gray)]">
                  <th className="px-5 py-3 text-left font-semibold">Employee</th>
                  <th className="px-5 py-3 text-left font-semibold">Team</th>
                  <th className="px-5 py-3 text-right font-semibold">Base Rate</th>
                  <th className="px-5 py-3 text-center font-semibold">Work Hours</th>
                  <th className="px-5 py-3 text-center font-semibold">Overtime Hours (OT)</th>
                  <th className="px-5 py-3 text-center font-semibold">Tardiness Penalties</th>
                  <th className="px-5 py-3 text-center font-semibold">Bonus Additions</th>
                  <th className="px-5 py-3 text-right font-semibold">Gross Pay Preview</th>
                  <th className="px-5 py-3 text-right font-semibold">Net Pay Preview</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]/30">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-xs text-[var(--cool-gray)]">
                      <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[var(--action-blue)]" />
                      Fetching workspace pay scales...
                    </td>
                  </tr>
                ) : filteredAdjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-xs text-[var(--cool-gray)] italic">
                      No adjustments logged for this period.
                    </td>
                  </tr>
                ) : (
                  filteredAdjustments.map((row) => {
                    const editable = canModifyRow(row);
                    const grossPreview = calculateGrossPreview(row);
                    const netPreview = calculateNetPreview(row);

                    return (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors text-xs text-white">
                        <td className="px-5 py-3.5 flex items-center gap-3">
                          <div className="size-8 rounded-full bg-gradient-to-br from-[var(--action-blue)] to-purple-500 flex items-center justify-center text-xs font-bold font-mono">
                            {row.employeeName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-semibold text-white">{row.employeeName}</span>
                            <span className="block text-[9px] text-[var(--cool-gray)] uppercase">
                              {row.isSalaried ? "Salaried" : "Hourly Contract"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-left text-[var(--cool-gray)]">{row.team}</td>

                        <td className="px-5 py-3.5 text-right font-semibold">
                          {row.isSalaried ? `${format(row.baseRate)}/mo` : `${format(row.baseRate)}/hr`}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              disabled={!editable || row.isSalaried || savingRows[row.employeeId]}
                              value={row.workHours !== undefined ? row.workHours : 160}
                              onChange={(e) => handleUpdateHours(row.employeeId, "workHours", parseFloat(e.target.value) || 0.0)}
                              className="w-16 h-8 text-center rounded bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)] disabled:opacity-40"
                            />
                            <span className="text-[10px] text-[var(--cool-gray)]">hrs</span>
                          </div>
                        </td>

                         <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              disabled={!editable || savingRows[row.employeeId]}
                              value={row.overtimeHours}
                              onChange={(e) => handleUpdateHours(row.employeeId, "overtimeHours", parseFloat(e.target.value) || 0.0)}
                              className="w-16 h-8 text-center rounded bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)] disabled:opacity-40"
                            />
                            <span className="text-[10px] text-[var(--cool-gray)]">hrs</span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              disabled={!editable || savingRows[row.employeeId]}
                              value={row.tardinessMinutes}
                              onChange={(e) => handleUpdateHours(row.employeeId, "tardinessMinutes", parseFloat(e.target.value) || 0.0)}
                              className="w-16 h-8 text-center rounded bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)] disabled:opacity-40"
                            />
                            <span className="text-[10px] text-[var(--cool-gray)]">mins</span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              disabled={!editable || savingRows[row.employeeId]}
                              value={row.bonus || 0.0}
                              onChange={(e) => handleUpdateHours(row.employeeId, "bonus", parseFloat(e.target.value) || 0.0)}
                              className="w-16 h-8 text-center rounded bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)] disabled:opacity-40"
                            />
                            <span className="text-[10px] text-[var(--cool-gray)]">PHP</span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-right font-bold text-[var(--mint-green)]">
                          {format(grossPreview)}
                        </td>

                        <td className="px-5 py-3.5 text-right font-bold text-[var(--action-blue)]">
                          {format(netPreview)}
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {editable && (
                              <button
                                onClick={() => handleSaveRow(row)}
                                disabled={savingRows[row.employeeId]}
                                className="px-2.5 py-1.5 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/90 transition-all font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {savingRows[row.employeeId] ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                                <span>Save</span>
                              </button>
                            )}

                            <button
                              disabled={loading || locking || processing}
                              onClick={() => {
                                // Simulate slip details dynamically
                                const base_hours = 160.0;
                                const base_gross = row.isSalaried ? row.baseRate : (row.baseRate * base_hours);
                                const hourly_rate = row.isSalaried ? (row.baseRate / base_hours) : row.baseRate;
                                const ot_pay = row.overtimeHours * hourly_rate * 1.5;
                                const tardiness_penalty = (row.tardinessMinutes / 60.0) * hourly_rate;
                                const bonus = row.bonus || 0.0;
                                const adjusted_gross = Math.max(0.0, (base_gross + ot_pay) - tardiness_penalty + bonus);
                                
                                const statutory_tax = adjusted_gross * 0.12;
                                const statutory_insurance = adjusted_gross * 0.04;
                                const voluntary_retirement = adjusted_gross * 0.02;
                                const voluntary_insurance = adjusted_gross > 100.0 ? 30.0 : 0.0;
                                const net_pay = adjusted_gross - (statutory_tax + statutory_insurance + voluntary_retirement + voluntary_insurance);

                                setSelectedPayslip({
                                  employeeName: row.employeeName,
                                  employeeId: row.employeeId,
                                  team: row.team,
                                  period: row.period,
                                  baseGross: base_gross,
                                  overtimeHours: row.overtimeHours,
                                  overtimeEarned: ot_pay,
                                  tardinessMinutes: row.tardinessMinutes,
                                  tardinessDeduction: tardiness_penalty,
                                  bonus: bonus,
                                  statutoryTax: statutory_tax,
                                  statutoryInsurance: statutory_insurance,
                                  voluntaryRetirement: voluntary_retirement,
                                  voluntaryInsurance: voluntary_insurance,
                                  netPay: net_pay,
                                  isSalaried: row.isSalaried
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-[var(--glass-border)] text-white hover:bg-white/5 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <FileText size={11} />
                              <span>Payslip</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Batch Bank Direct Deposit Result Modal (Simulated Output) ── */}
        {batchFileResult && (
          <div className="p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode size={18} className="text-[var(--action-blue)]" />
                <span className="text-sm font-bold text-white">Direct Deposit File Compiled (.ACH / Batch File)</span>
              </div>
              <button 
                onClick={() => setBatchFileResult(null)}
                className="text-xs text-[var(--cool-gray)] hover:text-white"
              >
                Dismiss
              </button>
            </div>
            
            <p className="text-[10px] text-[var(--cool-gray)]">ACH Direct Deposit instruction compiled successfully. Ready for treasury batch remittance to processing institutions.</p>
            
            <pre className="p-4 rounded bg-black/50 text-xs font-mono text-[var(--mint-green)] max-h-48 overflow-auto border border-white/5">
              {JSON.stringify(batchFileResult, null, 2)}
            </pre>

            <button
              onClick={() => {
                const element = document.createElement("a");
                const file = new Blob([JSON.stringify(batchFileResult, null, 2)], {type: 'application/json'});
                element.href = URL.createObjectURL(file);
                element.download = `Vantage_Payroll_DirectDeposit_${period.replace(" ", "_")}.json`;
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
              }}
              className="px-3.5 py-1.5 rounded bg-[var(--action-blue)] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[var(--action-blue)]/85 active:scale-[0.98] shadow-md transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>Download Direct Deposit Instructions</span>
            </button>
          </div>
        )}

        {/* ── Data Import Spreadsheet ── */}
        <div className="mb-6">
          <DataImportSheet onImportSuccess={handleImportTransactions} />
        </div>

        {/* ── General Vendor Expense Ledger ── */}
        <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--glass-border)] bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={15} className="text-[var(--cool-gray)]" />
              <span className="text-sm text-white">General &amp; Vendor Expense Ledger</span>
            </div>
            <span className="text-xs text-[var(--cool-gray)]">{transactions.length} active logs</span>
          </div>

          <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-[var(--glass-border)] bg-white/[0.015] text-xs text-[var(--cool-gray)] font-semibold">
            <div>Date</div>
            <div>Vendor / Description</div>
            <div>Category</div>
            <div className="text-right">Amount</div>
            <div className="text-right">Status</div>
          </div>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--cool-gray)] italic bg-white/[0.01]">
              No transactions imported or logged yet.
            </div>
          ) : (
            transactions.map((row, index) => (
              <div
                key={row.id}
                className={`grid grid-cols-5 gap-4 px-5 py-3.5 border-b border-[var(--glass-border)]/50 last:border-0 hover:bg-white/[0.03] transition-colors text-xs text-white ${
                  index % 2 === 1 ? "bg-white/[0.015]" : ""
                }`}
              >
                <div className="flex items-center text-[var(--cool-gray)]">{row.date}</div>
                <div className="flex items-center font-bold text-white">{row.description}</div>
                <div className="flex items-center text-[var(--cool-gray)]">{row.category}</div>
                <div className="flex items-center justify-end text-right font-semibold text-white">{format(row.amount)}</div>
                <div className="flex items-center justify-end">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    row.status === 'Paid' 
                      ? 'bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/35 text-[var(--mint-green)]' 
                      : row.status === 'Pending'
                        ? 'bg-orange-500/15 border border-orange-500/35 text-orange-400'
                        : 'bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/35 text-[var(--action-blue)]'
                  }`}>
                    <span className={`size-1.5 rounded-full ${
                      row.status === 'Paid' ? 'bg-[var(--mint-green)]' : row.status === 'Pending' ? 'bg-orange-400' : 'bg-[var(--action-blue)]'
                    }`} />
                    {row.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Finalized Payroll & Expenses Table ── */}
        <div className="rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--glass-border)] bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-[var(--cool-gray)]" />
              <span className="text-sm text-white">Payroll &amp; Operating Expenses Ledger</span>
            </div>
            <span className="text-xs text-[var(--cool-gray)]">{expenseLogs.length} processed runs</span>
          </div>

          {/* Table Headers */}
          <div className="grid grid-cols-6 gap-4 px-5 py-3 border-b border-[var(--glass-border)] bg-white/[0.015] text-xs text-[var(--cool-gray)]">
            <div>Disbursement Period</div>
            <div className="text-right">Total Gross Pay</div>
            <div className="text-right">Employer Taxes (5%)</div>
            <div className="text-right">Processing Fees</div>
            <div className="text-right">Ledger Cash Deducted</div>
            <div className="text-right">Status</div>
          </div>

          {/* Rows */}
          {expenseLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--cool-gray)] italic bg-white/[0.01]">
              No payroll disbursement runs have been executed or compiled yet.
            </div>
          ) : (
            expenseLogs.map((row, index) => (
              <tr
                key={row.id}
                className={`grid grid-cols-6 gap-4 px-5 py-3.5 border-b border-[var(--glass-border)]/50 last:border-0 hover:bg-white/[0.03] transition-colors text-xs text-white ${
                  index % 2 === 1 ? "bg-white/[0.015]" : ""
                }`}
              >
                <td className="flex items-center font-bold text-white">{row.period}</td>
                <td className="flex items-center justify-end text-right font-semibold text-[var(--cool-gray)]">{format(row.totalGrossPay)}</td>
                <td className="flex items-center justify-end text-right font-semibold text-purple-400">{format(row.employerTaxContribution)}</td>
                <td className="flex items-center justify-end text-right font-semibold text-[var(--cool-gray)]">{format(row.processingFees)}</td>
                <td className="flex items-center justify-end text-right font-bold text-[var(--mint-green)]">{format(row.bankLedgerDeducted)}</td>
                <td className="flex items-center justify-end">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--mint-green)]/15 border border-[var(--mint-green)]/35 text-[var(--mint-green)]">
                    <span className="size-1 bg-[var(--mint-green)] rounded-full" />
                    Paid &amp; Ledger Disbursed
                  </span>
                </td>
              </tr>
            ))
          )}
        </div>

        {/* ── Live Exchange Rate Footer ── */}
        <div className="mt-6 flex items-center justify-end gap-2 text-xs text-[var(--cool-gray)]">
          <RefreshCw size={12} className="text-[var(--mint-green)]" />
          <span>
            Live exchange rate · 1 PHP = {meta.rateFromPhp.toFixed(4)} {meta.code} · updated{" "}
            {ratesUpdatedAt.toLocaleString(meta.locale, {dateStyle: "medium", timeStyle: "short"})}
          </span>
        </div>

        {/* ── Employee Ingestion Dialog Modal ── */}
        {showImportModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in animate-duration-200">
            <div className="w-full max-w-lg p-6 rounded-2xl border border-white/10 bg-[#121622]/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="text-[var(--action-blue)]" size={18} />
                  <h3 className="text-md font-bold text-white">Import Employee Roster</h3>
                </div>
                <button onClick={() => setShowImportModal(false)} className="text-[var(--cool-gray)] hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--cool-gray)] block font-medium">
                    Upload CSV or paste JSON roster below:
                  </span>
                  
                  <button
                    onClick={() => empCsvInputRef.current?.click()}
                    className="px-2.5 py-1 rounded bg-[var(--action-blue)]/15 border border-[var(--action-blue)]/30 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/25 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Upload size={10} />
                    <span>Upload CSV File</span>
                  </button>
                  <input
                    ref={empCsvInputRef}
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleEmpCsvUpload}
                  />
                </div>

                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`[
  {
    "email": "sarah.chen@vantage.io",
    "fullName": "Sarah Chen",
    "team": "Team Alpha",
    "baseRate": 50.0,
    "isSalaried": true
  },
  {
    "email": "marcus.t@vantage.io",
    "fullName": "Marcus Thompson",
    "team": "Team Alpha",
    "baseRate": 45.0,
    "isSalaried": false
  }
]`}
                  className="w-full h-44 p-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)] font-mono resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5 text-xs font-bold">
                <button
                  onClick={() => {
                    setImportText(JSON.stringify([
                      {
                        "email": "dave.harris@vantage.io",
                        "fullName": "David Harris",
                        "team": "Team Alpha",
                        "baseRate": 52.0,
                        "isSalaried": true
                      },
                      {
                        "email": "lisa.wong@vantage.io",
                        "fullName": "Lisa Wong",
                        "team": "Team Beta",
                        "baseRate": 48.0,
                        "isSalaried": false
                      }
                    ], null, 2));
                  }}
                  className="px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  Load Template
                </button>

                <button
                  onClick={async () => {
                    try {
                      let parsed;
                      try {
                        parsed = JSON.parse(importText);
                      } catch {
                        alert("Invalid JSON format. Please correct it and retry.");
                        return;
                      }
                      if (!Array.isArray(parsed)) {
                        alert("Import payload must be a JSON array of employee objects.");
                        return;
                      }
                      
                      setProcessing(true);
                      const res = await apiFetch("/admin/import-employees", {
                        method: "POST",
                        body: { employees: parsed }
                      });
                      
                      if (res && res.success) {
                        setSuccessMsg(res.message || "Employees successfully imported!");
                        setTimeout(() => setSuccessMsg(""), 4000);
                        setShowImportModal(false);
                        setImportText("");
                        loadPayrollData();
                      }
                    } catch (e: any) {
                      alert(`Import process aborted: ${e.message}`);
                    } finally {
                      setProcessing(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/90 transition-all cursor-pointer"
                >
                  Trigger Atomic Import
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Employee Modal ── */}
        {showAddEmployeeModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#121622]/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="text-[var(--mint-green)]" size={18} />
                  <h3 className="text-md font-bold text-white">Add New Employee</h3>
                </div>
                <button onClick={() => setShowAddEmployeeModal(false)} className="text-[var(--cool-gray)] hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-left">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Full Name</label>
                  <input
                    type="text"
                    value={addEmpName}
                    onChange={(e) => setAddEmpName(e.target.value)}
                    placeholder="Sarah Chen"
                    className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Email Address</label>
                  <input
                    type="email"
                    value={addEmpEmail}
                    onChange={(e) => setAddEmpEmail(e.target.value)}
                    placeholder="sarah.chen@vantage.io"
                    className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                  />
                </div>

                {/* Team & Type Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 text-left">
                    <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Assigned Team</label>
                    <select
                      value={addEmpTeam}
                      onChange={(e) => setAddEmpTeam(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                    >
                      {allTeams.map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Pay Contract Type</label>
                    <select
                      value={addEmpIsSalaried ? "Salaried" : "Hourly"}
                      onChange={(e) => setAddEmpIsSalaried(e.target.value === "Salaried")}
                      className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                    >
                      <option value="Hourly">Hourly Contract</option>
                      <option value="Salaried">Salaried Monthly</option>
                    </select>
                  </div>
                </div>

                {/* Base Rate */}
                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">
                    {addEmpIsSalaried ? "Monthly Base Salary (PHP)" : "Hourly Pay Rate (PHP)"}
                  </label>
                  <input
                    type="number"
                    value={addEmpRate}
                    onChange={(e) => setAddEmpRate(e.target.value)}
                    placeholder={addEmpIsSalaried ? "50000" : "50"}
                    className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5 text-xs font-bold">
                <button
                  onClick={() => setShowAddEmployeeModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEmployeeSubmit}
                  disabled={processing}
                  className="px-4 py-2 rounded-lg bg-[var(--mint-green)] text-[var(--deep-slate)] hover:bg-[var(--mint-green)]/90 transition-all cursor-pointer disabled:opacity-50"
                >
                  {processing ? "Adding..." : "Add Employee"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Employee Modal ── */}
        {showEditEmployeeModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#121622]/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="text-purple-400" size={18} />
                  <h3 className="text-md font-bold text-white">Edit Employee Details</h3>
                </div>
                <button onClick={() => setShowEditEmployeeModal(false)} className="text-[var(--cool-gray)] hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-left">
                {/* Select Employee */}
                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Select Employee</label>
                  <select
                    value={selectedEditEmpId}
                    onChange={(e) => handleSelectEmployeeToEdit(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)] text-[11px]"
                  >
                    <option value="">-- Choose Employee --</option>
                    {adjustments.map((emp) => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.employeeName} ({emp.team})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedEditEmpId && (
                  <>
                    {/* Full Name */}
                    <div className="space-y-1">
                      <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Employee Name</label>
                      <input
                        type="text"
                        value={editEmpName}
                        onChange={(e) => setEditEmpName(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                      />
                    </div>

                    {/* Team & Type Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 text-left">
                        <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Assigned Team</label>
                        <select
                          value={editEmpTeam}
                          onChange={(e) => setEditEmpTeam(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                        >
                          {allTeams.map((team) => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 text-left">
                        <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Pay Contract Type</label>
                        <select
                          value={editEmpIsSalaried ? "Salaried" : "Hourly"}
                          onChange={(e) => setEditEmpIsSalaried(e.target.value === "Salaried")}
                          className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                        >
                          <option value="Hourly">Hourly Contract</option>
                          <option value="Salaried">Salaried Monthly</option>
                        </select>
                      </div>
                    </div>

                    {/* Base Rate */}
                    <div className="space-y-1">
                      <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">
                        {editEmpIsSalaried ? "Monthly Base Salary (PHP)" : "Hourly Pay Rate (PHP)"}
                      </label>
                      <input
                        type="number"
                        value={editEmpRate}
                        onChange={(e) => setEditEmpRate(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5 text-xs font-bold">
                <button
                  onClick={() => setShowEditEmployeeModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditEmployeeSubmit}
                  disabled={processing || !selectedEditEmpId}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  {processing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Digital Payslip Overlay Modal ── */}
        {selectedPayslip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg p-8 rounded-2xl border border-white/10 bg-[#121622]/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] space-y-6">
              
              {/* Header */}
              <div className="flex justify-between items-start border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Itemized Digital Payslip</h3>
                  <span className="text-[10px] text-[var(--cool-gray)] font-semibold uppercase font-mono bg-white/5 px-2 py-0.5 rounded">
                    Employee Ref ID: {selectedPayslip.employeeId}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-[var(--action-blue)]">VANTAGE ENTERPRISE</div>
                  <div className="text-[9px] text-[var(--cool-gray)]">Period: {selectedPayslip.period}</div>
                </div>
              </div>

              {/* Profile details */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                <div>
                  <span className="block text-[10px] text-[var(--cool-gray)] uppercase">Employee Name</span>
                  <span className="font-bold text-white">{selectedPayslip.employeeName}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--cool-gray)] uppercase">Cost Center / Team</span>
                  <span className="font-semibold text-white">{selectedPayslip.team}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-4">
                {/* Earnings */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--cool-gray)] tracking-wider mb-2">1. Compensation &amp; Earnings</div>
                  <div className="space-y-2 text-xs divide-y divide-white/5">
                    <div className="flex justify-between py-1 text-white">
                      <span>Base Compensation {selectedPayslip.isSalaried ? "(Salaried)" : "(160 standard hrs)"}</span>
                      <span>{format(selectedPayslip.baseGross)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-white">
                      <span>Overtime Earned ({selectedPayslip.overtimeHours} hrs @ 1.5x)</span>
                      <span className="text-[var(--mint-green)]">+{format(selectedPayslip.overtimeEarned)}</span>
                    </div>
                    {selectedPayslip.bonus > 0 && (
                      <div className="flex justify-between py-1 text-white">
                        <span>Bonus Additions</span>
                        <span className="text-[var(--mint-green)]">+{format(selectedPayslip.bonus)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1 text-white font-bold">
                      <span>Gross Compensation</span>
                      <span>{format(selectedPayslip.baseGross + selectedPayslip.overtimeEarned + (selectedPayslip.bonus || 0.0))}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--cool-gray)] tracking-wider mb-2">2. Adjustments &amp; Deductions</div>
                  <div className="space-y-2 text-xs divide-y divide-white/5">
                    <div className="flex justify-between py-1 text-white">
                      <span>Tardiness Penalty Deductions ({selectedPayslip.tardinessMinutes} mins reported)</span>
                      <span className="text-red-400">-{format(selectedPayslip.tardinessDeduction)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-white">
                      <span>Statutory Income Tax Withholding (12%)</span>
                      <span className="text-red-400">-{format(selectedPayslip.statutoryTax)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-white">
                      <span>Statutory Health &amp; Pension SSS Deductions (4%)</span>
                      <span className="text-red-400">-{format(selectedPayslip.statutoryInsurance)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-white">
                      <span>Voluntary Retirement Matching (2%)</span>
                      <span className="text-red-400">-{format(selectedPayslip.voluntaryRetirement)}</span>
                    </div>
                    {selectedPayslip.voluntaryInsurance > 0 && (
                      <div className="flex justify-between py-1 text-white">
                        <span>Voluntary Health Plan Premium</span>
                        <span className="text-red-400">-{format(selectedPayslip.voluntaryInsurance)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Net Pay */}
                <div className="p-4 rounded-xl bg-[var(--mint-green)]/10 border border-[var(--mint-green)]/20 flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Net Disbursed Take-home</span>
                  <span className="text-lg font-black text-[var(--mint-green)]">{format(selectedPayslip.netPay)}</span>
                </div>
              </div>

              {/* Close button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => {
                    const payslipJSON = JSON.stringify(selectedPayslip, null, 2);
                    const fileBlob = new Blob([payslipJSON], { type: 'application/json' });
                    const fileURL = URL.createObjectURL(fileBlob);
                    const link = document.createElement("a");
                    link.href = fileURL;
                    link.download = `Payslip_${selectedPayslip.employeeName.replace(" ", "_")}_${selectedPayslip.period.replace(" ", "_")}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs hover:bg-white/10 transition-colors font-bold cursor-pointer"
                >
                  Download JSON Slip
                </button>
                
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="px-4 py-2 rounded-lg bg-[var(--action-blue)] text-white text-xs hover:bg-[var(--action-blue)]/90 transition-all font-bold cursor-pointer"
                >
                  Close Payslip
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── Bank Payroll File Generator Modal ── */}
        {showBankFileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-4xl p-6 rounded-2xl border border-white/10 bg-[#121622]/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] space-y-6">
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="text-[var(--mint-green)]" size={20} />
                  <div>
                    <h3 className="text-md font-bold text-white">Bank Payroll File Generator</h3>
                    <p className="text-[10px] text-[var(--cool-gray)]">Compile direct-deposit batch payments for commercial banking networks in standard file formats.</p>
                  </div>
                </div>
                <button onClick={() => setShowBankFileModal(false)} className="text-[var(--cool-gray)] hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              {/* Form Input fields */}
              <div className="grid grid-cols-3 gap-6 text-xs text-left">
                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Payroll Distribution Date</label>
                  <input
                    type="date"
                    value={bankFileDate}
                    onChange={(e) => setBankFileDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Banking Network File Format</label>
                  <select
                    value={bankFileFormat}
                    onChange={(e) => setBankFileFormat(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                  >
                    <option value="CSV">CSV Format (Spreadsheet standard)</option>
                    <option value="TXT">TXT Format (Fixed-Width transmission)</option>
                    <option value="JSON">JSON Format (Banking API Standard)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Reference / Transaction Memo</label>
                  <input
                    type="text"
                    value={bankFileMemo}
                    onChange={(e) => setBankFileMemo(e.target.value)}
                    placeholder="e.g. Salary Distribution"
                    className="w-full h-10 px-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                  />
                </div>
              </div>

              {/* Dynamic Batch Preview Table */}
              <div className="space-y-2 text-left">
                <span className="text-xs font-semibold text-white">Direct Deposit Batch Preview (Net Salary Payouts)</span>
                <div className="max-h-60 overflow-y-auto border border-white/5 rounded-lg bg-black/20">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.01] text-[var(--cool-gray)] font-semibold">
                        <th className="px-4 py-2">Employee</th>
                        <th className="px-4 py-2">Team</th>
                        <th className="px-4 py-2">Bank / Channel</th>
                        <th className="px-4 py-2 font-mono">Account / Mobile</th>
                        <th className="px-4 py-2 text-right">Net Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white">
                      {adjustments.map((row) => {
                        const netPay = calculateNetPreview(row);
                        
                        // Resilient UI payout placeholders
                        const mockAccNum = `0917${Math.abs(hash(row.employeeId) % 10000000).toString().padStart(7, "0")}`;
                        const mockBank = row.isSalaried ? "BDO Unibank" : "GCash";
                        
                        return (
                          <tr key={row.id} className="hover:bg-white/[0.01]">
                            <td className="px-4 py-2.5 font-medium">{row.employeeName}</td>
                            <td className="px-4 py-2.5 text-[var(--cool-gray)]">{row.team}</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded bg-white/5 text-[var(--cool-gray)] text-[10px]">
                                {mockBank}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[var(--cool-gray)]">{mockAccNum}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-[var(--mint-green)]">{format(netPay)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/5 text-xs font-bold">
                <button
                  onClick={() => setShowBankFileModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleGenerateBankFileSubmit}
                  disabled={compilingBankFile || adjustments.length === 0}
                  className="px-5 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/85 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  {compilingBankFile ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>Generate &amp; Download Batch File</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ── Edit Bank Ledger Modal ── */}
        {showEditBankModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-[#121622]/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] space-y-4 text-left">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Landmark className="text-[var(--action-blue)]" size={18} />
                  <h3 className="text-md font-bold text-white">Manage Bank Ledger Baseline</h3>
                </div>
                <button onClick={() => setShowEditBankModal(false)} className="text-[var(--cool-gray)] hover:text-white transition-colors cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3.5 rounded-lg bg-[var(--action-blue)]/10 border border-[var(--action-blue)]/20 text-white leading-relaxed">
                  <span className="font-semibold text-[var(--action-blue)] block mb-1">Interactive Sandbox Configuration</span>
                  Configure the starting ledger cash balance for the active workspace. Vantage will dynamically compute the current cash balance based on this starting baseline, subtracting finalized payroll disbursements and paid general ledger transactions.
                </div>

                {/* Workspace indicator */}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 font-semibold font-mono">
                  <span className="text-[var(--cool-gray)] uppercase tracking-wider">Active Workspace</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--action-blue)]/25 text-[var(--action-blue)] text-[10px]">
                    {getWsId()}
                  </span>
                </div>

                {/* Input starting balance */}
                <div className="space-y-1">
                  <label className="block text-[var(--cool-gray)] font-semibold uppercase tracking-wider">Starting Balance baseline (PHP)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[var(--cool-gray)] font-bold">₱</span>
                    <input
                      type="number"
                      value={tempStartingBalance}
                      onChange={(e) => setTempStartingBalance(e.target.value)}
                      placeholder="1250000"
                      className="w-full h-10 pl-8 pr-3 rounded-lg bg-[var(--input-background)] border border-[var(--glass-border)] text-white font-bold focus:outline-none focus:ring-1 focus:ring-[var(--action-blue)]"
                    />
                  </div>
                </div>

                {/* Live calculation preview breakdown */}
                <div className="p-3.5 rounded-lg border border-white/5 bg-black/20 space-y-2.5">
                  <span className="font-bold text-white uppercase tracking-wider block border-b border-white/5 pb-1">Dynamic Calculation Preview</span>
                  
                  <div className="flex justify-between items-center text-[var(--cool-gray)]">
                    <span>Starting Balance baseline:</span>
                    <span className="font-mono font-bold text-white">{format(Number(tempStartingBalance) || 0)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[var(--cool-gray)]">
                    <span>Processed Payroll Deductions:</span>
                    <span className="font-mono font-semibold text-red-400">-{format(totalPaidNet)}</span>
                  </div>

                  <div className="flex justify-between items-center text-[var(--cool-gray)]">
                    <span>General Ledger Paid Transactions:</span>
                    <span className="font-mono font-semibold text-red-400">-{format(totalPaidGeneral)}</span>
                  </div>

                  <div className="flex justify-between items-center border-t border-white/5 pt-2 font-bold text-white text-sm">
                    <span>Resulting Cash Balance:</span>
                    <span className="font-mono text-[var(--mint-green)]">
                      {format((Number(tempStartingBalance) || 0) - totalPaidNet - totalPaidGeneral)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-white/5 text-xs font-bold">
                <button
                  onClick={() => setShowEditBankModal(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const parsedValue = parseFloat(tempStartingBalance);
                    if (isNaN(parsedValue) || parsedValue < 0) {
                      alert("Please specify a valid, non-negative starting balance baseline.");
                      return;
                    }
                    const wsId = getWsId();
                    localStorage.setItem(`vantage_bank_starting_balance_${wsId}`, parsedValue.toString());
                    setShowEditBankModal(false);
                    setSuccessMsg(`Starting bank ledger baseline set to ${format(parsedValue)}.`);
                    setTimeout(() => setSuccessMsg(""), 4000);
                    loadPayrollData();
                  }}
                  className="px-4 py-2 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/90 active:scale-[0.98] transition-all cursor-pointer shadow-lg"
                >
                  Save Baseline
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
