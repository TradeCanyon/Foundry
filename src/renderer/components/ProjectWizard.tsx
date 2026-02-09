/**
 * @license
 * Copyright 2025 Foundry (foundry.app)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectWizard — Modal wizard for creating new Foundry projects.
 * Steps: Name/Instructions → Type + Workspace → Goals → Review & Create
 */

import { ipcBridge } from '@/common';
import React, { useState, useCallback } from 'react';
import { Message } from '@arco-design/web-react';
import { useNavigate } from 'react-router-dom';

const PROJECT_TYPES = [
  { key: 'software', label: 'Software', icon: '\u{1F4BB}', description: 'Apps, APIs, CLI tools' },
  { key: 'web', label: 'Web', icon: '\u{1F310}', description: 'Sites, landing pages, dashboards' },
  { key: 'content', label: 'Content', icon: '\u{1F4DD}', description: 'Docs, blogs, courses' },
  { key: 'marketing', label: 'Marketing', icon: '\u{1F4E3}', description: 'Campaigns, launches, SEO' },
  { key: 'business', label: 'Business', icon: '\u{1F4CA}', description: 'Plans, pitches, research' },
  { key: 'creative', label: 'Creative', icon: '\u{1F3A8}', description: 'Design, video, games' },
  { key: 'data', label: 'Data', icon: '\u{1F4C8}', description: 'Analysis, ML, pipelines' },
  { key: 'devops', label: 'DevOps', icon: '\u{2699}\u{FE0F}', description: 'CI/CD, infra, monitoring' },
  { key: 'other', label: 'Other', icon: '\u{1F4E6}', description: 'Something else entirely' },
];

type ProjectWizardProps = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (workspace: string) => void;
};

type WizardStep = 'basics' | 'type' | 'goals' | 'review' | 'done';

const ProjectWizard: React.FC<ProjectWizardProps> = ({ visible, onClose, onCreated }) => {
  const [step, setStep] = useState<WizardStep>('basics');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('software');
  const [workspace, setWorkspace] = useState('');
  const [goals, setGoals] = useState<string[]>(['']);
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createdWorkspace, setCreatedWorkspace] = useState('');
  const navigate = useNavigate();

  const reset = useCallback(() => {
    setStep('basics');
    setName('');
    setDescription('');
    setProjectType('software');
    setWorkspace('');
    setGoals(['']);
    setReferenceFiles([]);
    setCreating(false);
    setCreatedWorkspace('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSelectWorkspace = useCallback(async () => {
    const result = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory', 'createDirectory'] });
    if (result && result.length > 0) {
      setWorkspace(result[0]);
    }
  }, []);

  const handleAddGoal = useCallback(() => {
    if (goals.length < 5) {
      setGoals([...goals, '']);
    }
  }, [goals]);

  const handleUpdateGoal = useCallback(
    (index: number, value: string) => {
      const updated = [...goals];
      updated[index] = value;
      setGoals(updated);
    },
    [goals]
  );

  const handleRemoveGoal = useCallback(
    (index: number) => {
      setGoals(goals.filter((_, i) => i !== index));
    },
    [goals]
  );

  const handleAddReferenceFiles = useCallback(async () => {
    const result = await ipcBridge.dialog.showOpen.invoke({ properties: ['openFile', 'multiSelections'] });
    if (result && result.length > 0) {
      setReferenceFiles((prev) => [...prev, ...result.filter((f) => !prev.includes(f))]);
    }
  }, []);

  const handleRemoveReferenceFile = useCallback(
    (path: string) => {
      setReferenceFiles(referenceFiles.filter((f) => f !== path));
    },
    [referenceFiles]
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !workspace) return;

    setCreating(true);
    try {
      const result = await ipcBridge.project.init.invoke({
        workspace,
        name: name.trim(),
        description: description.trim(),
        type: projectType,
        goals: goals.filter((g) => g.trim()),
      });

      if (result.success) {
        // Copy reference files if any
        if (referenceFiles.length > 0) {
          try {
            await ipcBridge.fs.copyFilesToWorkspace.invoke({
              filePaths: referenceFiles,
              workspace: `${workspace}/.foundry`,
            });
          } catch {
            // Non-fatal — project was created, just files didn't copy
            console.warn('Some reference files failed to copy');
          }
        }

        Message.success(`Project "${name.trim()}" created`);
        setCreatedWorkspace(workspace);
        setStep('done');
        onCreated?.(workspace);
      } else {
        Message.error(result.msg || 'Failed to create project');
      }
    } catch (error) {
      Message.error('Failed to create project');
    } finally {
      setCreating(false);
    }
  }, [name, description, projectType, workspace, goals, referenceFiles, onCreated]);

  if (!visible) return null;

  const canProceedBasics = name.trim().length > 0;
  const canProceedType = workspace.length > 0;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--bg-3)',
    backgroundColor: 'var(--bg-2)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
  };

  const buttonPrimary: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#ff6b35',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  };

  const buttonSecondary: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid var(--bg-3)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    cursor: 'pointer',
  };

  const renderBasics = () => (
    <div className='flex flex-col gap-16px'>
      <div>
        <label className='block text-13px font-500 mb-6px' style={{ color: 'var(--text-secondary)' }}>
          Project Name *
        </label>
        <input style={inputStyle} placeholder='My awesome project' value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && canProceedBasics && setStep('type')} />
      </div>
      <div>
        <label className='block text-13px font-500 mb-4px' style={{ color: 'var(--text-secondary)' }}>
          Project Instructions
        </label>
        <div className='text-11px mb-6px' style={{ color: 'var(--text-tertiary)' }}>
          These instructions will be given to every AI agent working in this project. Describe goals, constraints, coding standards, etc.
        </div>
        <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} placeholder='e.g., "Use TypeScript strict mode. Follow REST conventions. Write tests for new features."' value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className='flex justify-end gap-8px mt-8px'>
        <button style={buttonSecondary} onClick={handleClose}>
          Cancel
        </button>
        <button style={{ ...buttonPrimary, opacity: canProceedBasics ? 1 : 0.5 }} onClick={() => canProceedBasics && setStep('type')} disabled={!canProceedBasics}>
          Next
        </button>
      </div>
    </div>
  );

  const renderType = () => (
    <div className='flex flex-col gap-16px'>
      <div>
        <label className='block text-13px font-500 mb-8px' style={{ color: 'var(--text-secondary)' }}>
          Project Type
        </label>
        <div className='grid gap-8px' style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {PROJECT_TYPES.map((t) => (
            <button
              key={t.key}
              className='flex items-center gap-10px px-12px py-10px rd-8px b-1 b-solid cursor-pointer text-left transition-all duration-150'
              style={{
                backgroundColor: projectType === t.key ? 'var(--bg-2)' : 'transparent',
                borderColor: projectType === t.key ? '#ff6b35' : 'var(--bg-3)',
                color: 'var(--text-primary)',
              }}
              onClick={() => setProjectType(t.key)}
            >
              <span className='text-18px'>{t.icon}</span>
              <div>
                <div className='text-13px font-500'>{t.label}</div>
                <div className='text-11px' style={{ color: 'var(--text-tertiary)' }}>
                  {t.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className='block text-13px font-500 mb-6px' style={{ color: 'var(--text-secondary)' }}>
          Workspace Directory *
        </label>
        <div className='flex gap-8px'>
          <input style={{ ...inputStyle, flex: 1 }} placeholder='Select a directory...' value={workspace} readOnly />
          <button style={buttonSecondary} onClick={handleSelectWorkspace}>
            Browse
          </button>
        </div>
      </div>

      {/* Reference Materials */}
      <div>
        <label className='block text-13px font-500 mb-4px' style={{ color: 'var(--text-secondary)' }}>
          Reference Materials (optional)
        </label>
        <div className='text-11px mb-6px' style={{ color: 'var(--text-tertiary)' }}>
          Upload design docs, specs, or other files agents should reference. Files will be copied to the .foundry/ directory.
        </div>
        <div className='flex flex-wrap gap-6px mb-6px'>
          {referenceFiles.map((path) => (
            <div key={path} className='flex items-center gap-4px px-8px py-4px rd-6px text-12px' style={{ backgroundColor: 'var(--bg-2)', border: '1px solid var(--bg-3)' }}>
              <span style={{ color: 'var(--text-primary)' }}>{path.split(/[/\\]/).pop()}</span>
              <span className='cursor-pointer ml-2px' style={{ color: 'var(--text-tertiary)' }} onClick={() => handleRemoveReferenceFile(path)}>
                {'\u00D7'}
              </span>
            </div>
          ))}
        </div>
        <button className='text-13px b-none bg-transparent cursor-pointer' style={{ color: '#ff6b35' }} onClick={() => void handleAddReferenceFiles()}>
          + Add files
        </button>
      </div>

      <div className='flex justify-between mt-8px'>
        <button style={buttonSecondary} onClick={() => setStep('basics')}>
          Back
        </button>
        <button style={{ ...buttonPrimary, opacity: canProceedType ? 1 : 0.5 }} onClick={() => canProceedType && setStep('goals')} disabled={!canProceedType}>
          Next
        </button>
      </div>
    </div>
  );

  const renderGoals = () => (
    <div className='flex flex-col gap-16px'>
      <div>
        <label className='block text-13px font-500 mb-8px' style={{ color: 'var(--text-secondary)' }}>
          Project Goals (optional)
        </label>
        <div className='flex flex-col gap-8px'>
          {goals.map((goal, i) => (
            <div key={i} className='flex gap-8px'>
              <input style={{ ...inputStyle, flex: 1 }} placeholder={`Goal ${i + 1} — e.g., "Build MVP", "Launch beta"`} value={goal} onChange={(e) => handleUpdateGoal(i, e.target.value)} />
              {goals.length > 1 && (
                <button className='flex items-center justify-center w-36px h-36px rd-8px b-1 b-solid cursor-pointer flex-shrink-0' style={{ borderColor: 'var(--bg-3)', backgroundColor: 'transparent', color: 'var(--text-tertiary)' }} onClick={() => handleRemoveGoal(i)}>
                  {'\u00D7'}
                </button>
              )}
            </div>
          ))}
          {goals.length < 5 && (
            <button className='text-13px b-none bg-transparent cursor-pointer text-left' style={{ color: '#ff6b35' }} onClick={handleAddGoal}>
              + Add goal
            </button>
          )}
        </div>
      </div>
      <div className='flex justify-between mt-8px'>
        <button style={buttonSecondary} onClick={() => setStep('type')}>
          Back
        </button>
        <div className='flex gap-8px'>
          <button
            style={buttonSecondary}
            onClick={() => {
              setGoals(['']);
              setStep('review');
            }}
          >
            Skip
          </button>
          <button style={buttonPrimary} onClick={() => setStep('review')}>
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderReview = () => {
    const typeInfo = PROJECT_TYPES.find((t) => t.key === projectType);
    const filteredGoals = goals.filter((g) => g.trim());
    return (
      <div className='flex flex-col gap-16px'>
        <div className='rd-8px p-16px' style={{ backgroundColor: 'var(--bg-2)' }}>
          <div className='text-15px font-600 mb-4px' style={{ color: 'var(--text-primary)' }}>
            {name}
          </div>
          {description && (
            <div className='text-13px mb-8px' style={{ color: 'var(--text-secondary)' }}>
              {description}
            </div>
          )}
          <div className='flex items-center gap-8px mb-8px'>
            <span className='text-14px'>{typeInfo?.icon}</span>
            <span className='text-13px font-500' style={{ color: 'var(--text-primary)' }}>
              {typeInfo?.label}
            </span>
          </div>
          <div className='text-12px' style={{ color: 'var(--text-tertiary)' }}>
            {workspace}
          </div>
          {filteredGoals.length > 0 && (
            <div className='mt-12px pt-12px' style={{ borderTop: '1px solid var(--bg-3)' }}>
              <div className='text-12px font-500 mb-4px' style={{ color: 'var(--text-secondary)' }}>
                Goals
              </div>
              {filteredGoals.map((g, i) => (
                <div key={i} className='text-12px mb-2px' style={{ color: 'var(--text-primary)' }}>
                  {i + 1}. {g}
                </div>
              ))}
            </div>
          )}
          {referenceFiles.length > 0 && (
            <div className='mt-12px pt-12px' style={{ borderTop: '1px solid var(--bg-3)' }}>
              <div className='text-12px font-500 mb-4px' style={{ color: 'var(--text-secondary)' }}>
                Reference Materials
              </div>
              {referenceFiles.map((f) => (
                <div key={f} className='text-12px mb-2px' style={{ color: 'var(--text-primary)' }}>
                  📄 {f.split(/[/\\]/).pop()}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className='text-12px' style={{ color: 'var(--text-tertiary)' }}>
          This will create a <code>.foundry/</code> directory in your workspace with project configuration, instructions, and skill folders.
        </div>
        <div className='flex justify-between mt-8px'>
          <button style={buttonSecondary} onClick={() => setStep('goals')}>
            Back
          </button>
          <button style={{ ...buttonPrimary, opacity: creating ? 0.6 : 1 }} onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    );
  };

  const renderDone = () => (
    <div className='flex flex-col gap-16px items-center text-center'>
      <div className='text-36px'>✅</div>
      <div className='text-16px font-600' style={{ color: 'var(--text-primary)' }}>
        Project "{name}" created!
      </div>
      <div className='text-13px' style={{ color: 'var(--text-tertiary)' }}>
        What would you like to do next?
      </div>
      <div className='flex gap-12px mt-8px'>
        <button
          style={buttonPrimary}
          onClick={() => {
            handleClose();
            void navigate('/guid', { state: { workspace: createdWorkspace } });
          }}
        >
          Start a conversation
        </button>
        <button
          style={buttonSecondary}
          onClick={() => {
            handleClose();
            void navigate(`/projects/${encodeURIComponent(createdWorkspace)}`);
          }}
        >
          View project
        </button>
      </div>
    </div>
  );

  const stepTitles: Record<WizardStep, string> = {
    basics: 'New Project',
    type: 'Project Type & Workspace',
    goals: 'Project Goals',
    review: 'Review & Create',
    done: 'Project Created',
  };

  const stepNumbers: Record<WizardStep, number> = { basics: 1, type: 2, goals: 3, review: 4, done: 5 };

  return (
    <div className='fixed inset-0 z-1000 flex items-center justify-center' style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={handleClose}>
      <div
        className='rd-16px overflow-hidden'
        style={{
          width: '500px',
          maxHeight: '80vh',
          backgroundColor: 'var(--bg-1)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-24px py-16px' style={{ borderBottom: '1px solid var(--bg-3)' }}>
          <div>
            <div className='text-16px font-600' style={{ color: 'var(--text-primary)' }}>
              {stepTitles[step]}
            </div>
            {step !== 'done' && (
              <div className='text-12px mt-2px' style={{ color: 'var(--text-tertiary)' }}>
                Step {stepNumbers[step]} of 4
              </div>
            )}
          </div>
          <button className='flex items-center justify-center w-28px h-28px rd-full b-none cursor-pointer' style={{ backgroundColor: 'var(--bg-2)', color: 'var(--text-secondary)' }} onClick={handleClose}>
            {'\u00D7'}
          </button>
        </div>

        {/* Content */}
        <div className='px-24px py-20px overflow-y-auto' style={{ maxHeight: 'calc(80vh - 70px)' }}>
          {step === 'basics' && renderBasics()}
          {step === 'type' && renderType()}
          {step === 'goals' && renderGoals()}
          {step === 'review' && renderReview()}
          {step === 'done' && renderDone()}
        </div>
      </div>
    </div>
  );
};

export default ProjectWizard;
