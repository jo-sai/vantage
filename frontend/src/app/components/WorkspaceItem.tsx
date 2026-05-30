interface WorkspaceItemProps {
  name: string;
  count: number;
  color: string;
  isActive: boolean;
  onClick: () => void;
}

export function WorkspaceItem({ name, count, color, isActive, onClick }: WorkspaceItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all relative ${
        isActive
          ? 'bg-[var(--action-blue)]/10 border-[var(--action-blue)]/30 shadow-lg'
          : 'bg-white/5 border-[var(--glass-border)] hover:bg-white/10'
      }`}
    >
      {/* Active Indicator Bar */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--action-blue)] rounded-r-full"></div>
      )}

      <div className={`size-3 rounded-full ${color} ${isActive ? 'shadow-lg' : ''}`}></div>
      <span className={`flex-1 text-left ${isActive ? 'text-white' : 'text-white'}`}>
        {name}
      </span>
      <span
        className={`size-6 rounded-full text-xs flex items-center justify-center ${
          isActive
            ? 'bg-[var(--action-blue)]/30 text-[var(--action-blue)]'
            : 'bg-[var(--action-blue)]/20 text-[var(--action-blue)]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
