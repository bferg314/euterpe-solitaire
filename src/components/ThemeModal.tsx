import React from 'react';
import type { ThemeId } from '../types/solitaire';
import { THEMES } from '../services/themeService';
import { Palette, X, Check } from 'lucide-react';

interface ThemeModalProps {
  currentTheme: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  onClose: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  currentTheme,
  onSelectTheme,
  onClose,
}) => {
  const themeList = Object.values(THEMES);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card theme-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Palette size={20} className="gold-icon" />
            <h3>Table Themes & Atmospheres</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="themes-grid">
          {themeList.map((theme) => {
            const isSelected = currentTheme === theme.id;

            return (
              <div
                key={theme.id}
                className={`theme-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectTheme(theme.id)}
              >
                <div
                  className="theme-preview-box"
                  style={{
                    background: theme.bgGradient,
                    borderColor: isSelected ? theme.accentColor : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    className="theme-felt-layer"
                    style={{ background: theme.feltOverlay }}
                  />
                  <div
                    className="theme-mini-card"
                    style={{ borderColor: theme.railColor }}
                  >
                    <span style={{ color: theme.accentColor }}>♠</span>
                  </div>
                  {isSelected && (
                    <div className="theme-selected-badge" style={{ background: theme.accentColor }}>
                      <Check size={14} color="#000" />
                    </div>
                  )}
                </div>

                <div className="theme-info">
                  <span className="theme-name">{theme.name}</span>
                  <p className="theme-desc">{theme.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
