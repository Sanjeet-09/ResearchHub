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
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  StatusDot,
  Avatar,
  AvatarStack,
  Tabs,
  Dialog,
  ConfirmDialog,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  EmptyState,
  ProgressBar,
  PageHeader,
  IconChip,
  toast,
} from '../components/ui';
import {
  Sparkles,
  Trash2,
  FolderPlus,
  FolderKanban,
  TestTube2,
  Database,
  CalendarClock,
  Terminal,
  Check,
  Zap,
} from 'lucide-react';

export const DesignSystemPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [progress, setProgress] = useState(65);

  const sampleTabs = [
    { id: 'overview', label: 'Overview', icon: FolderKanban },
    { id: 'experiments', label: 'Experiments', icon: TestTube2, badge: '12' },
    { id: 'datasets', label: 'Datasets', icon: Database, badge: '4' },
    { id: 'lab', label: 'Testing Lab', icon: Terminal },
  ];

  const neutralTokens = [
    { label: '--bg', value: '#0A0A0A', desc: 'Page background', bg: 'bg-[#0A0A0A]' },
    { label: '--surface-1', value: '#111111', desc: 'Cards, tables, island', bg: 'bg-[#111111]' },
    { label: '--surface-2', value: '#171717', desc: 'Inputs, hover rows, nested areas', bg: 'bg-[#171717]' },
    { label: '--surface-3', value: '#1F1F1F', desc: 'Selected / active / pressed', bg: 'bg-[#1F1F1F]' },
    { label: '--border', value: '#242424', desc: 'Default 1px hairline border', bg: 'bg-[#242424]' },
    { label: '--border-strong', value: '#353535', desc: 'Hover, focused, island border', bg: 'bg-[#353535]' },
    { label: '--text', value: '#EDEDED', desc: 'Primary typography', bg: 'bg-[#EDEDED]', text: 'text-[#0A0A0A]' },
    { label: '--text-2', value: '#A1A1A1', desc: 'Secondary typography', bg: 'bg-[#A1A1A1]', text: 'text-[#0A0A0A]' },
    { label: '--text-3', value: '#6E6E6E', desc: 'Hints, placeholders, disabled', bg: 'bg-[#6E6E6E]', text: 'text-[#EDEDED]' },
  ];

  const statusTokens = [
    { label: 'Success / Online', textHex: '#4ADE80', bgHex: '#0F2418', variant: 'success', status: 'online' },
    { label: 'Warning / Idle', textHex: '#FBBF24', bgHex: '#2A2008', variant: 'warning', status: 'idle' },
    { label: 'Danger / Stop', textHex: '#F87171', bgHex: '#2D1315', variant: 'danger', status: 'stop' },
    { label: 'Info', textHex: '#60A5FA', bgHex: '#0F1C30', variant: 'info', status: 'info' },
  ];

  return (
    <div className="space-y-10 pb-16 select-none">
      <PageHeader
        title="Graphite Design System"
        description="Strictly opaque, monochrome, and neutral design specification (UI Guide v3) with hairline borders, floating island navigation, and meaningful status highlights."
        action={
          <Button
            variant="primary"
            icon={Sparkles}
            onClick={() => toast.success('Graphite design system tokens active and verified!')}
          >
            Verify Tokens
          </Button>
        }
      />

      {/* 1. Neutral Tokens */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          1. Neutral Tokens (Strictly Opaque — Section 1.1)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-3">
          {neutralTokens.map((t) => (
            <div key={t.label} className="p-3 bg-surface-1 border border-border rounded-[8px] flex flex-col justify-between h-28 shadow-[inset_0_1px_0_#1A1A1A]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-text">{t.label}</span>
                <span className={`w-3.5 h-3.5 rounded-full border border-border shrink-0 ${t.bg}`} />
              </div>
              <div>
                <span className="font-mono text-xs text-text-3 block">{t.value}</span>
                <span className="text-[11px] text-text-2 block mt-0.5 leading-tight">{t.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Primary Action & Focus Ring */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          2. Primary Action & Focus Ring (Section 1.2)
        </h2>
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="p-3 bg-primary text-primary-fg rounded-[8px] font-medium text-xs">
              --primary: #EDEDED / --primary-fg: #0A0A0A
            </div>
            <div className="p-3 bg-surface-2 border border-border rounded-[8px] text-xs text-text flex items-center gap-2">
              <span>Focus Ring:</span>
              <code className="font-mono text-[11px] text-text-2">outline: 2px solid #EDEDED, offset 2px</code>
            </div>
          </div>
        </Card>
      </section>

      {/* 3. Status Tokens */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          3. Status Colours (Solid Text on Solid Dark Tint — Section 1.3)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statusTokens.map((s) => (
            <div
              key={s.label}
              className="p-4 rounded-[8px] border border-border flex items-center justify-between"
              style={{ backgroundColor: s.bgHex }}
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold block" style={{ color: s.textHex }}>
                  {s.label}
                </span>
                <span className="font-mono text-[11px] block text-text-2 opacity-80">
                  {s.textHex} on {s.bgHex}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={s.status} />
                <Badge variant={s.variant} size="sm">
                  {s.variant}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Dot Pattern Demonstration */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          4. Dot Pattern (The Only Allowed Texture — Section 4.2)
        </h2>
        <div className="h-28 w-full rounded-[12px] bg-surface-1 border border-border dot-pattern flex items-center justify-center p-6 shadow-[inset_0_1px_0_#1A1A1A]">
          <div className="px-4 py-2 rounded-full bg-surface-2 border border-border-strong text-xs text-text font-mono flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
            radial-gradient(#2A2A2A 1px, transparent 1px) with 14px grid
          </div>
        </div>
      </section>

      {/* 5. Buttons */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          5. Buttons (Section 5)
        </h2>
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="md">
              Primary (36px)
            </Button>
            <Button variant="secondary" size="md">
              Secondary (36px)
            </Button>
            <Button variant="ghost" size="md">
              Ghost Button
            </Button>
            <Button variant="danger" size="md" icon={Trash2}>
              Danger Action
            </Button>
            <Button variant="primary" size="lg">
              Large (44px)
            </Button>
            <Button variant="primary" size="sm">
              Small (32px)
            </Button>
            <Button variant="primary" size="md" isLoading>
              Loading
            </Button>
          </div>
        </Card>
      </section>

      {/* 6. Form Controls */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          6. Form Controls & Inputs (Section 5)
        </h2>
        <Card className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input label="Default text input" placeholder="Enter repository name..." />
            <Input label="Mono input with error" error="Checksum verification failed" value="0x4f8b91c..." mono />
            <Select
              label="Select menu"
              options={[
                { value: 'active', label: 'Active status' },
                { value: 'planning', label: 'Planning stage' },
                { value: 'completed', label: 'Completed project' },
              ]}
            />
            <div className="md:col-span-3">
              <Textarea label="Textarea description" placeholder="Notes, parameter logs, or experiment summary..." rows={3} />
            </div>
            <div className="flex items-center gap-6">
              <Checkbox
                label="Allow GPU compute"
                checked={checkboxChecked}
                onChange={() => setCheckboxChecked(!checkboxChecked)}
              />
              <Switch
                label="Auto-checkpoint"
                checked={switchChecked}
                onChange={() => setSwitchChecked(!switchChecked)}
              />
            </div>
          </div>
        </Card>
      </section>

      {/* 7. Badges, Dots & Avatars */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          7. Badges, StatusDots & Avatars (Section 5)
        </h2>
        <Card className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="neutral">neutral</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="warning">warning</Badge>
            <Badge variant="danger">danger</Badge>
            <Badge variant="info">info</Badge>
            <Badge variant="aiml">AI/ML</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-border">
            <StatusDot status="online" label="Online (pulsing)" />
            <StatusDot status="running" label="Running (pulsing)" />
            <StatusDot status="idle" label="Idle / Paused" />
            <StatusDot status="stop" label="Stopped" />
            <StatusDot status="offline" label="Offline" />
          </div>

          <div className="flex items-center gap-6 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Avatar name="Dr. Alex Rivera" size="sm" />
              <Avatar name="Dr. Alex Rivera" size="md" />
              <Avatar name="Dr. Alex Rivera" size="lg" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-3 font-mono">AvatarStack:</span>
              <AvatarStack
                users={[
                  { name: 'Dr. Rivera' },
                  { name: 'Prof. Chen' },
                  { name: 'Sam Taylor' },
                  { name: 'Morgan Lee' },
                  { name: 'Alex Wong' },
                ]}
                size="sm"
                max={4}
              />
            </div>
          </div>
        </Card>
      </section>

      {/* 8. Underline Tabs & Pill Tabs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          8. Tabs (Underline & Pill — Section 4.4 & Section 5)
        </h2>
        <Card className="p-5 space-y-6">
          <div>
            <div className="text-xs text-text-3 mb-2 font-mono">Underline Tabs (Default):</div>
            <Tabs tabs={sampleTabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
          </div>

          <div>
            <div className="text-xs text-text-3 mb-2 font-mono">Pill Tabs:</div>
            <Tabs tabs={sampleTabs} activeTab={activeTab} onChange={setActiveTab} variant="pill" />
          </div>
        </Card>
      </section>

      {/* 9. Cards, Table & EmptyState */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          9. Table & EmptyState (Section 5)
        </h2>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Checksum</TableHead>
                <TableHead>Last updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <span className="font-medium text-text">Dataset snapshot</span>
                </TableCell>
                <TableCell>HDF5 Archive</TableCell>
                <TableCell>
                  <Badge variant="success" size="sm">Indexed</Badge>
                </TableCell>
                <TableCell mono>e9c4b2a8</TableCell>
                <TableCell mono>12 mins ago</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <span className="font-medium text-text">Hyperparameter sweep</span>
                </TableCell>
                <TableCell>PyTorch Experiment</TableCell>
                <TableCell>
                  <Badge variant="info" size="sm">Running</Badge>
                </TableCell>
                <TableCell mono>1a4f00d2</TableCell>
                <TableCell mono>1 hour ago</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <EmptyState
          icon={FolderPlus}
          title="No experiments found"
          description="Record parameter sweeps, logs, and artifacts directly in your workspace."
          actionLabel="Log an experiment"
          onAction={() => toast.info('Experiment logger opened')}
        />
      </section>

      {/* 10. Dialog & Toast Trigger */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">
          10. Overlays & Dialogs (Section 5)
        </h2>
        <Card className="p-5 flex flex-wrap items-center gap-4">
          <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
            Open Dialog
          </Button>
          <Button variant="danger" onClick={() => setIsConfirmOpen(true)}>
            Open Confirm Dialog
          </Button>
          <Button variant="ghost" onClick={() => toast.info('Graphite notification alert')}>
            Trigger Sonner Toast
          </Button>
        </Card>
      </section>

      {/* Sample Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Sample Dialog Modal"
        description="Floating shadow, 12px radius, and solid neutral surfaces."
      >
        <div className="space-y-4 text-xs text-text-2">
          <p>
            Dialog overlays use 70% black alpha backdrop with solid surface-1 container and border-strong outline.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-border">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setIsDialogOpen(false)}>
              Acknowledge
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Sample ConfirmDialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          toast.success('Confirmed action successfully executed');
        }}
        title="Delete Resource"
        description="Are you sure you want to delete this resource? Type CONFIRM below to execute."
        confirmName="CONFIRM"
        variant="danger"
      />
    </div>
  );
};
