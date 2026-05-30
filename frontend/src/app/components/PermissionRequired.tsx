import { ShieldAlert, Mail } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "./RoleContext";

interface Props {
  pageName: string;
  description?: string;
}

export function PermissionRequired({ pageName, description }: Props) {
  const { role } = useRole();

  const handleContact = () => {
    toast.success("Request sent to Org Admin", {
      description: `Access to ${pageName} requested.`,
      style: {
        background: "var(--deep-slate)",
        border: "1px solid var(--action-blue)",
        color: "white",
      },
    });
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-8 relative">
      {/* Glassmorphic overlay backdrop */}
      <div className="absolute inset-0 bg-[#0F1419]/60 backdrop-blur-xl" />

      <div className="relative z-10 max-w-md w-full rounded-lg bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] p-8 text-center shadow-2xl">
        <div className="size-16 mx-auto mb-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <ShieldAlert size={28} className="text-amber-400" />
        </div>

        <h2 className="text-xl text-white mb-2">Permission Required</h2>
        <p className="text-sm text-[var(--cool-gray)] mb-2">
          {description ?? `Your role (${role}) does not have access to ${pageName}.`}
        </p>
        <p className="text-xs text-[var(--cool-gray)] mb-8">
          Contact your Organization Admin to request access.
        </p>

        <button
          onClick={handleContact}
          className="w-full px-6 py-3 rounded-lg bg-[var(--action-blue)] text-white hover:bg-[var(--action-blue)]/80 shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all flex items-center justify-center gap-2"
        >
          <Mail size={16} />
          <span>Contact Org Admin</span>
        </button>
      </div>
    </div>
  );
}
