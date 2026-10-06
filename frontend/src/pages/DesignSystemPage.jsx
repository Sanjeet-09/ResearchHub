import React, { useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Badge,
  StatusDot,
  Avatar,
  Tabs,
  Dialog,
  ConfirmDialog,
  Dropdown,
  Tooltip,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  EmptyState,
  ProgressBar,
  Timeline,
  TimelineItem,
  PageHeader,
  toast
} from '../components/ui';
import { Sparkles, Trash2, FolderPlus, GitCommit, Copy, RotateCcw, AlertTriangle } from 'lucide-react';

export const DesignSystemPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [progress, setProgress] = useState(65);

  const sampleTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'experiments', label: 'Experiments', badge: '12' },
    { id: 'datasets', label: 'Datasets', badge: '4' },
    { id: 'lab', label: 'Testing Environment' },
  ];

  return (
    <div className="space-y-10 pb-16">
      <PageHeader
        title="Design System & Component Library"
        description="Dark minimalist theme tokens, typography, and atomic UI components per Section 3."
        action={
          <Button icon={Sparkles} onClick={() => toast.success('Design System system state verified!')}>
            Verify Tokens
          </Button>
        }
      />

      {/* 1. Buttons */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          1. Buttons & Variants
        </h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="primary">Primary Accent</Button>
          <Button variant="secondary">Secondary Surface</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="danger" icon={Trash2}>Danger Action</Button>
          <Button variant="primary" isLoading>Loading State</Button>
          <Button variant="secondary" disabled>Disabled State</Button>
        </div>
      </section>

      {/* 2. Inputs & Form Controls */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          2. Form Controls
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input label="Standard Input" placeholder="Enter project title..." hint="Allowed characters: A-Z, 0-9" />
          <Input label="Monospace Input" placeholder="sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" mono />
          <Input label="Error State" value="Invalid dataset format" error="Selected file format .xyz is not supported" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Select label="Select Role" options={[
            { label: 'Professor (Admin)', value: 'professor' },
            { label: 'Researcher', value: 'researcher' },
            { label: 'Student', value: 'student' }
          ]} />
          <div className="flex flex-col gap-3 pt-6">
            <Checkbox label="Enable GPU for student accounts" checked={checkboxChecked} onChange={(e) => setCheckboxChecked(e.target.checked)} />
            <Switch label="Auto-pause idle lab sessions (10 min)" checked={switchChecked} onChange={(e) => setSwitchChecked(e.target.checked)} />
          </div>
        </div>
        <Textarea label="Markdown Notes" placeholder="Record experiment hypothesis, parameters, and key findings..." rows={3} />
      </section>

      {/* 3. Badges & Status Dots */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          3. Badges & Live Status Dots
        </h2>
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="ghost">Ghost</Badge>
          <Badge variant="accent" mono>v2.4.0</Badge>
        </div>
        <div className="flex flex-wrap gap-6 items-center pt-2">
          <StatusDot status="running" label="Running (soft pulse)" />
          <StatusDot status="online" label="Online" />
          <StatusDot status="idle" label="Idle" />
          <StatusDot status="paused" label="Paused" />
          <StatusDot status="failed" label="Failed" />
          <StatusDot status="stopped" label="Stopped" />
        </div>
      </section>

      {/* 4. Avatars */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          4. Avatars (Initials & Deterministic Colors)
        </h2>
        <div className="flex items-center gap-4">
          <Avatar name="Prof. Eleanor Vance" size="sm" />
          <Avatar name="Dr. Alan Grant" size="md" />
          <Avatar name="Alex Chen" size="lg" />
          <Avatar name="Quantum Research Group" size="md" />
        </div>
      </section>

      {/* 5. Tabs & Progress */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          5. Tabs & Progress Bar
        </h2>
        <Tabs tabs={sampleTabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="pt-2 max-w-md">
          <ProgressBar progress={progress} label="Dataset upload progress" showValue variant="accent" />
        </div>
      </section>

      {/* 6. Cards & AI/ML Glow */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          6. Cards & AI/ML Glow Effect
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Standard Lab Configuration</CardTitle>
              <Badge variant="ghost" mono>2 vCPU · 8 GiB</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-txt-muted">Includes Python 3.11, scipy, scikit-learn, seaborn, statsmodels.</p>
            </CardContent>
            <CardFooter>
              <span className="text-xs font-mono text-txt-faint">$0.10 / hr</span>
              <Button size="sm" variant="secondary">Select</Button>
            </CardFooter>
          </Card>

          <Card glow selected>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>AI/ML — GPU Container</CardTitle>
                <Badge variant="accent">AI / ML</Badge>
              </div>
              <Badge variant="accent" mono>1x NVIDIA L4</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-txt-muted">PyTorch (CUDA), torchvision, scikit-learn, xgboost, lightgbm.</p>
            </CardContent>
            <CardFooter>
              <span className="text-xs font-mono text-txt-faint">$0.70 / hr</span>
              <Button size="sm" variant="primary">Launch Lab</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* 7. Dataset Versions Timeline */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          7. Dataset Version Control Timeline (Section 3.7)
        </h2>
        <Timeline>
          <TimelineItem
            icon={GitCommit}
            badge={<Badge variant="accent" mono>v2.0</Badge>}
            title="Cleaned feature vectors and added 2026 test split"
            subtitle="Uploaded by Dr. Alan Grant · 245.8 MB"
            time="2 hours ago"
            action={<Button size="sm" variant="ghost" icon={Copy}>Copy SHA</Button>}
          >
            <p className="font-mono text-[11px] text-txt-faint">checksum: a8f9c102e7b45d90184c2f1094857</p>
          </TimelineItem>

          <TimelineItem
            icon={GitCommit}
            badge={<Badge variant="ghost" mono>v1.0</Badge>}
            title="Initial raw survey dataset upload"
            subtitle="Uploaded by Alex Chen · 180.2 MB"
            time="3 days ago"
            action={<Button size="sm" variant="ghost" icon={RotateCcw}>Restore</Button>}
          >
            <p className="font-mono text-[11px] text-txt-faint">checksum: f47ac10b58cc4372a56708902b489</p>
          </TimelineItem>
        </Timeline>
      </section>

      {/* 8. Table */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          8. Tables & Data Display
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hourly Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold">Electron Microscope (SEM-500)</TableCell>
              <TableCell>Building B - Room 102</TableCell>
              <TableCell><StatusDot status="online" label="Available" /></TableCell>
              <TableCell mono>$15.00/hr</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold">High-Performance Compute Cluster</TableCell>
              <TableCell>Data Center - Rack 4</TableCell>
              <TableCell><StatusDot status="running" label="Booked" /></TableCell>
              <TableCell mono>$4.50/hr</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      {/* 9. Skeletons & Empty State */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          9. Loading Skeletons & Empty States
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 bg-surface border border-border rounded-card space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </div>
          <EmptyState
            title="No active research experiments"
            description="Create a new experiment hypothesis to begin tracking results."
            actionLabel="Create Experiment"
            onAction={() => toast.info('Create experiment clicked')}
          />
        </div>
      </section>

      {/* 10. Modals & Dialogs */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-txt-muted border-b border-border pb-2">
          10. Dialogs, Overlays & Toasts
        </h2>
        <div className="flex flex-wrap gap-4 items-center">
          <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
            Open Standard Modal
          </Button>
          <Button variant="danger" icon={AlertTriangle} onClick={() => setIsConfirmOpen(true)}>
            Open Destructive Confirm Modal
          </Button>
          <Tooltip content="Hover tooltip explanation text">
            <Button variant="ghost">Hover Tooltip</Button>
          </Tooltip>
          <Dropdown
            trigger={<Button variant="secondary">Dropdown Menu</Button>}
            items={[
              { label: 'View Details', onClick: () => toast.info('View details') },
              { label: 'Edit Project', onClick: () => toast.info('Edit project') },
              { divider: true },
              { label: 'Delete Project', danger: true, onClick: () => toast.error('Delete clicked') },
            ]}
          />
        </div>
      </section>

      {/* Dialog Instances */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Lab Configuration Details"
        description="Review container resource specs and dependencies before launching."
      >
        <div className="space-y-4 text-xs text-txt-muted">
          <p>This lab environment provisions a Cloud Run container with 2 vCPU and 8 GiB RAM.</p>
          <div className="p-3 rounded bg-surface-2 font-mono text-txt">
            pip install numpy pandas matplotlib scipy scikit-learn
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => { setIsDialogOpen(false); toast.success('Session launch initiated'); }}>
              Confirm & Launch
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          toast.error('Session lab-3901 deleted permanently');
        }}
        title="Stop Lab Session & Wipe Workspace"
        description="Stopping the session permanently deletes all workspace files and notebook checkpoints. This action cannot be undone."
        confirmName="lab-3901"
        confirmText="Permanently Stop Session"
      />
    </div>
  );
};
