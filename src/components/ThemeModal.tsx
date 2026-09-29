import React from 'react';
import type { ThemeId } from '../types/solitaire';
import { THEMES } from '../services/themeService';
import { Palette, Check } from 'lucide-react';
import { Modal } from './Modal';

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
    <Modal title="Table Themes & Atmospheres" icon={<Palette size={20} className="gold-icon" />} className="theme-modal-card" onClose={onClose}>

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
    </Modal>
  );
};
