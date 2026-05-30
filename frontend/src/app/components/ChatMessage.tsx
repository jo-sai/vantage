import { useState } from "react";
import { Reply, Copy } from "lucide-react";
import { toast } from "sonner";

interface ChatMessageProps {
  id: number;
  author: string;
  avatar: string;
  message: string;
  timestamp: string;
  isCurrentUser: boolean;
  isActive?: boolean;
  onReply?: (author: string, text: string) => void;
}

export function ChatMessage({ id, author, avatar, message, timestamp, isCurrentUser, isActive = false, onReply }: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setIsCopied(true);
    toast.success("Copied to clipboard", {
      description: "Message text copied successfully.",
      style: { background: "var(--deep-slate)", border: "1px solid var(--glass-border)", color: "white" },
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleReplyClick = () => {
    if (onReply) {
      const isReply = message.startsWith("Replying to @");
      let cleanText = message;
      if (isReply) {
        const doubleNewlineIndex = message.indexOf("\n\n");
        if (doubleNewlineIndex !== -1) {
          cleanText = message.slice(doubleNewlineIndex + 2);
        } else {
          const match = message.match(/^Replying to @[^:]+:\s*"[^"]+"\s*(.*)$/s);
          if (match && match[1]) {
            cleanText = match[1];
          }
        }
      }
      onReply(author, cleanText);
    }
  };

  const isReply = message.startsWith("Replying to @");
  let replyPart = "";
  let messagePart = message;

  if (isReply) {
    const doubleNewlineIndex = message.indexOf("\n\n");
    if (doubleNewlineIndex !== -1) {
      replyPart = message.slice(0, doubleNewlineIndex);
      messagePart = message.slice(doubleNewlineIndex + 2);
    } else {
      const match = message.match(/^(Replying to @[^:]+:\s*"[^"]+")\s*(.*)$/s);
      if (match) {
        replyPart = match[1];
        messagePart = match[2];
      }
    }
  }

  return (
    <div
      className={`flex gap-3 mb-4 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar with Status */}
      <div className="relative flex-shrink-0">
        <div className={`size-10 rounded-full flex items-center justify-center text-sm text-white ${avatar}`}>
          {author.charAt(0)}
        </div>
        {isActive && (
          <div className="absolute bottom-0 right-0 size-3 bg-[var(--mint-green)] border-2 border-[#0F1419] rounded-full"></div>
        )}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col max-w-[60%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1">
          {!isCurrentUser && <span className="text-xs text-[var(--cool-gray)]">{author}</span>}
          <span className="text-xs text-[var(--cool-gray)]">{timestamp}</span>
        </div>

        <div className="relative group">
          <div
            className={`px-5 py-3 rounded-[16px] leading-relaxed text-sm ${
              isCurrentUser
                ? 'bg-[#3b82f6] text-white shadow-[0_4px_16px_rgba(59,130,246,0.15)]'
                : 'bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] text-white'
            }`}
          >
            {isReply && replyPart ? (
              <div className="text-sm text-white/80 leading-relaxed font-normal mb-1">
                {replyPart}
              </div>
            ) : null}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {isReply ? messagePart : message}
            </p>
          </div>

          {/* Hover Actions */}
          {isHovered && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 ${
                isCurrentUser ? 'right-full mr-3' : 'left-full ml-3'
              } flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10`}
            >
              <button
                onClick={handleReplyClick}
                className="size-8 rounded-lg bg-[#1A1F2C]/60 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                title="Reply"
              >
                <Reply size={14} className="text-white/60 hover:text-white" />
              </button>
              <button
                onClick={handleCopy}
                className="size-8 rounded-lg bg-[#1A1F2C]/60 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer"
                title="Copy Message"
              >
                <Copy size={14} className={isCopied ? "text-[var(--mint-green)]" : "text-white/60 hover:text-white"} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
