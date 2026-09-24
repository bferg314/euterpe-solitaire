import React from 'react';
import { GitFork, AlertCircle, X } from 'lucide-react';

interface DeadlockBannerProps {
  reason?: string;
  onOpenFork: () => void;
  onDismiss: () => void;
}

export const DeadlockBanner: React.FC<DeadlockBannerProps> = ({
  reason,
  onOpenFork,
  onDismiss,
}) => {
  return (
    <div className="deadlock-banner">
      <div className="deadlock-banner-content">
        <div className="deadlock-icon-wrap">
          <AlertCircle size={18} className="deadlock-alert-icon" />
        </div>
        <div className="deadlock-text-wrap">
          <span className="deadlock-title">Deadlock Reached</span>
          <span className="deadlock-desc">
            {reason || 'No legal moves remaining on this board.'} Unwind key decisions and test alternative paths.
          </span>
        </div>
      </div>

      <div className="deadlock-actions">
        <button className="fork-banner-btn" onClick={onOpenFork} title="Open scrubbable move timeline">
          <GitFork size={15} />
          <span>The Fork</span>
        </button>
        <button className="deadlock-dismiss-btn" onClick={onDismiss} title="Dismiss notification">
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
