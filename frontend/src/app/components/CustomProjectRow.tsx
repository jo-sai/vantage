import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, MessageSquare, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface SubTask {
  id: string;
  name: string;
  start: number;
  duration: number;
}

export interface CustomProject {
  id: string;
  name: string;
  start: number;
  duration: number;
  generateGantt: boolean;
  subTasks: SubTask[];
  location?: string;
  dependsOnId?: string;
  dependsOnName?: string;
}

interface Props {
  project: CustomProject;
  daysInTimeline: number;
  onAddSubTask: (projectId: string) => void;
  onUpdateSubTask: (projectId: string, subTaskId: string, start: number) => void;
  canEdit?: boolean;
  isEmployee?: boolean;
  onComment?: (name: string, day: number) => void;
  onDeleteProject?: (projectId: string) => void;
  onDeleteSubTask?: (projectId: string, subTaskId: string) => void;
}

export function CustomProjectRow({ project, daysInTimeline, onAddSubTask, onUpdateSubTask, canEdit = true, isEmployee = false, onComment, onDeleteProject, onDeleteSubTask }: Props) {
  const [expanded, setExpanded] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border-t border-[var(--glass-border)] bg-[var(--action-blue)]/[0.04]">
      {/* Parent Project Row */}
      <div className="flex hover:bg-white/5 transition-colors">
        <div className="w-96 shrink-0 p-4 border-r border-[var(--glass-border)] flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--cool-gray)] hover:text-white transition-colors"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="flex-1 min-w-0 flex flex-col gap-1.5 py-1">
            {/* Row 1: Project Name */}
            <div className="text-sm font-semibold text-white truncate" title={project.name}>
              {project.name}
            </div>
            
            {/* Row 2: Badges/Tags (stackable/wrap) */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {project.location && (
                <span 
                  className="px-2 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1 shrink-0"
                  title={`Location: ${project.location}`}
                >
                  <span className="shrink-0">📍</span>
                  <span>{project.location}</span>
                </span>
              )}
              {project.dependsOnName && (
                <span 
                  className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1 shrink-0" 
                  title={`Depends on: ${project.dependsOnName}`}
                >
                  <span className="shrink-0">🔗</span>
                  <span className="max-w-[180px] truncate">
                    Depends on: {project.dependsOnName}
                  </span>
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--action-blue)]/20 text-[var(--action-blue)] border border-[var(--action-blue)]/30 shrink-0">
                Custom
              </span>
            </div>
            
            {/* Row 3: Sub-task count */}
            <span className="text-[11px] text-[var(--cool-gray)] font-medium">
              {project.subTasks.length} sub-task{project.subTasks.length !== 1 ? "s" : ""}
            </span>
          </div>
          {isEmployee ? (
            <button
              onClick={() => onComment?.(project.name, project.start)}
              className="size-7 rounded flex items-center justify-center bg-[var(--mint-green)]/20 text-[var(--mint-green)] hover:bg-[var(--mint-green)]/30 transition-all shrink-0"
              title="Comment on this Gantt bar"
            >
              <MessageSquare size={14} />
            </button>
          ) : canEdit ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => onAddSubTask(project.id)}
                className="size-7 rounded flex items-center justify-center bg-[var(--action-blue)]/20 text-[var(--action-blue)] hover:bg-[var(--action-blue)]/30 transition-all"
                title="Add sub-task"
              >
                <Plus size={14} />
              </button>
              {onDeleteProject && (
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove the custom project "${project.name}"?`)) {
                      onDeleteProject(project.id);
                    }
                  }}
                  className="size-7 rounded flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                  title="Remove project"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Parent Bar */}
        <div ref={gridRef} className="flex-1 relative flex">
          {Array.from({ length: daysInTimeline }, (_, i) => {
            const day = i + 1;
            const inProject = day >= project.start && day < project.start + project.duration;
            return (
              <div key={day} className="flex-1 min-w-[40px] border-r border-[var(--glass-border)]">
                {inProject && (
                  <div className="h-full p-2.5">
                    <div className="h-full rounded-sm bg-[var(--action-blue)]/70 border border-[var(--action-blue)] shadow-[0_0_12px_rgba(59,130,246,0.25)]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-task Rows */}
      <AnimatePresence initial={false}>
        {expanded && project.subTasks.map((sub) => (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex hover:bg-white/[0.03] transition-colors overflow-hidden group"
          >
            <div className="w-96 shrink-0 py-2.5 pr-4 pl-12 border-r border-[var(--glass-border)] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-1.5 rounded-full bg-[var(--cool-gray)] shrink-0" />
                <span className="text-xs text-[var(--cool-gray)] truncate">{sub.name}</span>
              </div>
              {canEdit && !isEmployee && onDeleteSubTask && (
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove sub-task "${sub.name}"?`)) {
                      onDeleteSubTask(project.id, sub.id);
                    }
                  }}
                  className="size-5 rounded flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-all border border-red-500/20 opacity-0 group-hover:opacity-100 shrink-0"
                  title="Remove sub-task"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
            <SubTaskBar
              sub={sub}
              project={project}
              daysInTimeline={daysInTimeline}
              onUpdate={(newStart) => onUpdateSubTask(project.id, sub.id, newStart)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface SubTaskBarProps {
  sub: SubTask;
  project: CustomProject;
  daysInTimeline: number;
  onUpdate: (newStart: number) => void;
}

function SubTaskBar({ sub, project, daysInTimeline, onUpdate }: SubTaskBarProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previewStart, setPreviewStart] = useState(sub.start);
  const dragState = useRef<{ startX: number; cellW: number; origStart: number } | null>(null);

  useEffect(() => setPreviewStart(sub.start), [sub.start]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!rowRef.current) return;
    e.preventDefault();
    const cellW = rowRef.current.getBoundingClientRect().width / daysInTimeline;
    dragState.current = { startX: e.clientX, cellW, origStart: sub.start };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const { startX, cellW, origStart } = dragState.current;
      const delta = Math.round((e.clientX - startX) / cellW);
      const projEnd = project.start + project.duration;
      const minStart = project.start;
      const maxStart = Math.min(daysInTimeline + 1 - sub.duration, projEnd - sub.duration);
      const next = Math.max(minStart, Math.min(maxStart, origStart + delta));
      setPreviewStart(next);
    };
    const onUp = () => {
      if (dragState.current && previewStart !== sub.start) {
        onUpdate(previewStart);
      }
      dragState.current = null;
      setDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, previewStart, sub.start, sub.duration, project.start, project.duration, daysInTimeline, onUpdate]);

  return (
    <div ref={rowRef} className="flex-1 relative flex">
      {Array.from({ length: daysInTimeline }, (_, i) => {
        const day = i + 1;
        const inSub = day >= previewStart && day < previewStart + sub.duration;
        return (
          <div key={day} className="flex-1 min-w-[40px] border-r border-[var(--glass-border)]">
            {inSub && (
              <div className="h-full py-2 px-1">
                <div
                  onMouseDown={handleMouseDown}
                  className={`h-full rounded-sm bg-[var(--mint-green)]/50 border border-[var(--mint-green)]/80 cursor-grab ${
                    dragging ? "cursor-grabbing ring-2 ring-[var(--mint-green)]/60" : ""
                  } hover:bg-[var(--mint-green)]/70 transition-colors relative group`}
                  title={`${sub.name} — drag to reschedule`}
                >
                  {day === previewStart && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/90 whitespace-nowrap pointer-events-none">
                      {sub.name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
