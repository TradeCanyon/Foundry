/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SuggestedActionPills — Horizontal row of pill-shaped action buttons below the SendBox.
 * Inspired by MiniMax Agent's category pills (Schedules, Websites, Research, etc.).
 * Shows on empty/new conversation state. Clicking a pill activates its category
 * and shows contextual prompt templates.
 */

import React, { useState, useCallback } from 'react';

// Category definitions with icons and colors
export type ActionCategory = 'schedules' | 'websites' | 'research' | 'images' | 'writing' | 'code';

type CategoryDef = {
  key: ActionCategory;
  label: string;
  icon: string;
  color: string;
};

const CATEGORIES: CategoryDef[] = [
  { key: 'schedules', label: 'Schedules', icon: '\u{1F4C5}', color: '#22c55e' },
  { key: 'research', label: 'Research', icon: '\u{1F4CA}', color: '#8b5cf6' },
  { key: 'writing', label: 'Writing', icon: '\u{270F}\u{FE0F}', color: '#f59e0b' },
  { key: 'code', label: 'Code', icon: '\u{1F4BB}', color: '#3b82f6' },
  { key: 'websites', label: 'Websites', icon: '\u{1F310}', color: '#06b6d4' },
  { key: 'images', label: 'Images', icon: '\u{1F3A8}', color: '#ec4899' },
];

// Template prompts per category
export const CATEGORY_TEMPLATES: Record<ActionCategory, string[]> = {
  schedules: ['At 10:00 each day, deliver a concise briefing on the most important tech and science news from the last 24 hours.', 'Start my mornings at 9:00 by compiling a quick summary of all unread work emails since the previous evening.', "Every Monday at 15:00, research and analyze the past week's trending topics, summarizing the key points.", 'When 14:50 rolls around on workdays, bring me fresh intel on the market — current prices, trend signals.', 'On the 25th of each month at 17:00, compile a monthly report summarizing key metrics and changes.'],
  research: ['Provide a comprehensive overview of the current open-source AI ecosystem. What are the key players?', 'Research the latest advancements in local-first software architecture and summarize the key patterns.', "Analyze the competitive landscape for AI development tools — who's winning and why?", 'Write a literature review on the relationship between developer experience and productivity metrics.', "Research emerging trends in AI agent frameworks — what's working and what's failing?"],
  writing: ['Help me write a technical blog post about building Electron apps with React and TypeScript.', 'Draft a project proposal for implementing a new feature — include scope, timeline, and risks.', 'Create a clear, concise README for a developer tool with installation, usage, and API sections.', 'Write release notes for a major version update, highlighting breaking changes and new features.', 'Help me craft a compelling pitch for my startup — focus on the problem, solution, and market.'],
  code: ['Review my codebase for potential security vulnerabilities and suggest fixes.', 'Help me refactor this module to use TypeScript strict mode with proper type safety.', 'Write comprehensive unit tests for the authentication module with edge cases.', 'Design a database schema for a project management system with teams and permissions.', 'Create a CI/CD pipeline configuration for building and deploying an Electron app.'],
  websites: ['Build a modern landing page with a hero section, features grid, pricing table, and footer.', 'Create a responsive portfolio website with a dark theme, project gallery, and contact form.', 'Design a dashboard layout with sidebar navigation, data cards, and interactive charts.', 'Build a documentation site with search, sidebar navigation, and syntax-highlighted code blocks.', 'Create a product launch page with countdown timer, email signup, and social proof section.'],
  images: ['Generate a professional logo for a tech startup called "Foundry" — minimal, modern, bold.', 'Create a series of UI mockups for a mobile app onboarding flow with 4 screens.', 'Design a social media banner set (Twitter, LinkedIn, Facebook) with consistent branding.', 'Generate concept art for a futuristic AI development workspace environment.', 'Create an infographic showing the architecture of a microservices system.'],
};

type SuggestedActionPillsProps = {
  activeCategory: ActionCategory | null;
  onCategorySelect: (category: ActionCategory | null) => void;
  visible?: boolean;
};

const SuggestedActionPills: React.FC<SuggestedActionPillsProps> = ({ activeCategory, onCategorySelect, visible = true }) => {
  if (!visible) return null;

  return (
    <div className='flex items-center gap-8px flex-wrap justify-center mt-8px'>
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => onCategorySelect(isActive ? null : cat.key)}
            className='flex items-center gap-4px px-12px py-6px rd-20px b-1 b-solid cursor-pointer transition-all duration-150 text-13px font-500 select-none'
            style={{
              backgroundColor: isActive ? `${cat.color}15` : 'var(--bg-1)',
              borderColor: isActive ? `${cat.color}40` : 'var(--bg-3)',
              color: isActive ? cat.color : 'var(--text-secondary)',
            }}
          >
            <span className='text-14px'>{cat.icon}</span>
            <span>{cat.label}</span>
            {isActive && (
              <span
                className='ml-2px text-12px cursor-pointer'
                onClick={(e) => {
                  e.stopPropagation();
                  onCategorySelect(null);
                }}
              >
                \u00D7
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Template suggestions component
type ActionTemplatesProps = {
  category: ActionCategory;
  onSelect: (template: string) => void;
};

export const ActionTemplates: React.FC<ActionTemplatesProps> = ({ category, onSelect }) => {
  const templates = CATEGORY_TEMPLATES[category];
  if (!templates?.length) return null;

  return (
    <div className='flex flex-col gap-1px mt-8px'>
      {templates.map((template, i) => (
        <button
          key={i}
          onClick={() => onSelect(template)}
          className='flex items-center justify-between px-12px py-10px rd-8px b-none bg-transparent cursor-pointer transition-all duration-150 text-left w-full'
          style={{
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-2)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <span className='text-13px lh-20px flex-1 overflow-hidden text-ellipsis' style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
            {template}
          </span>
          <span className='flex-shrink-0 ml-8px text-16px opacity-40'>{'\u2197'}</span>
        </button>
      ))}
    </div>
  );
};

// Hook for managing action pill state
export function useActionPills() {
  const [activeCategory, setActiveCategory] = useState<ActionCategory | null>(null);
  const [hasMessages, setHasMessages] = useState(false);

  const handleCategorySelect = useCallback((category: ActionCategory | null) => {
    setActiveCategory(category);
  }, []);

  const handleTemplateSelect = useCallback((template: string) => {
    setActiveCategory(null);
    return template;
  }, []);

  // Pills visible only when no messages in conversation
  const pillsVisible = !hasMessages;

  return {
    activeCategory,
    handleCategorySelect,
    handleTemplateSelect,
    pillsVisible,
    setHasMessages,
  };
}

export default SuggestedActionPills;
