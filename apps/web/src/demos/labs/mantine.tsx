import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Group,
  MantineProvider,
  NumberInput,
  Progress,
  Select,
  Stack,
  Stepper,
  TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import dayjs from 'dayjs';
import '../styles/mantine.css';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Status, useThemeColors } from '../lab-kit';

/* ------------------------------------------------------------------ *
 * Mantine Stepper driving a real three-step form.
 *
 * NOTE: `@mantine/form` is NOT installed in this repo, so there is no
 * useForm() to call. Validation below is an explicit rule function whose
 * result is fed straight into each input's `error` prop — the gating and
 * the per-field messages are still driven by the same rule set.
 * ------------------------------------------------------------------ */

interface FormValues {
  project: string;
  email: string;
  concurrency: number | string;
  region: string | null;
  instances: number | string;
  canaryRatio: number;
  canary: boolean;
  monitoring: boolean;
  agree: boolean;
}

const INITIAL: FormValues = {
  project: '风控规则中心',
  email: 'ops@example.com',
  concurrency: 120,
  region: '华东-杭州',
  instances: 3,
  canaryRatio: 10,
  canary: true,
  monitoring: true,
  agree: false,
};

type Errors = Partial<Record<keyof FormValues, string>>;

function validateStep(step: number, values: FormValues): Errors {
  const errors: Errors = {};
  if (step === 0) {
    if (values.project.trim().length < 2) errors.project = '项目名至少 2 个字';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = '邮箱格式不正确';
    const concurrency = Number(values.concurrency);
    if (!Number.isFinite(concurrency) || concurrency <= 0) errors.concurrency = '并发预估必须是正数';
  }
  if (step === 1) {
    if (!values.region) errors.region = '请选择部署区域';
    const instances = Number(values.instances);
    if (!Number.isFinite(instances) || instances < 1 || instances > 20) errors.instances = '实例数需在 1 - 20 之间';
    if (values.canary && (values.canaryRatio < 1 || values.canaryRatio > 50)) {
      errors.canaryRatio = '灰度比例需在 1% - 50% 之间';
    }
  }
  if (step === 2) {
    if (!values.agree) errors.agree = '需要勾选后才能提交';
  }
  return errors;
}

function useSiteTheme(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setMode(root.dataset.theme === 'dark' ? 'dark' : 'light');
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return mode;
}

export default function MantineLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const mode = useSiteTheme();
  const colors = useThemeColors();

  return (
    <MantineProvider
      forceColorScheme={mode}
      theme={{
        primaryColor: 'orange',
        fontFamily: 'var(--font-sans)',
        defaultRadius: 'sm',
        components: {
          Stepper: { defaultProps: { size: 'xs', orientation: 'vertical' } },
        },
      }}
    >
      <MantineInner onCopy={onCopy} accent={colors.accent ?? '#d95a3f'} mode={mode} />
    </MantineProvider>
  );
}

function MantineInner({ onCopy, accent, mode }: { onCopy: DemoCopyHandler; accent: string; mode: 'light' | 'dark' }) {
  const narrow = useMediaQuery('(max-width: 560px)');
  const [active, setActive] = useState(0);
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => validateStep(active, values), [active, values]);
  const errorList = Object.entries(errors) as [keyof FormValues, string][];
  const canGoNext = errorList.length === 0;

  const patch = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  /* dayjs does real formatting work in the summary step. */
  const plan = useMemo(() => {
    const now = dayjs();
    const weeks = Math.max(1, Math.ceil(Number(values.instances) / 2));
    return {
      id: `REQ-${now.format('YYYYMMDD')}-${String(values.instances).padStart(2, '0')}`,
      launch: now.add(weeks, 'week').format('YYYY 年 M 月 D 日'),
      capacity: Number(values.concurrency) * Number(values.instances),
      builtAt: now.format('YYYY-MM-DD HH:mm:ss'),
    };
  }, [values.concurrency, values.instances]);

  const snippet = useMemo(
    () =>
      [
        `<MantineProvider forceColorScheme={siteTheme} withNormalizeCSS={false}>`,
        `  <Stepper active={active} onStepClick={setActive} orientation="vertical" size="xs">`,
        `    <Stepper.Step label="基本信息" description="项目与容量">`,
        `      <TextInput label="项目名称" error={errors.project} value={values.project}`,
        `        onChange={(e) => patch('project', e.currentTarget.value)} />`,
        `      <NumberInput label="并发预估" error={errors.concurrency}`,
        `        value={values.concurrency} onChange={(v) => patch('concurrency', v)} />`,
        `    </Stepper.Step>`,
        `    <Stepper.Step label="团队配置" description="区域与灰度">…</Stepper.Step>`,
        `    <Stepper.Step label="确认提交" description="核对清单">…</Stepper.Step>`,
        `  </Stepper>`,
        `  <Progress value={((active + 1) / 3) * 100} />`,
        `</MantineProvider>`,
        ``,
        `// 本仓库没有安装 @mantine/form（MantineProvider 也没有 withNormalizeCSS 这个 prop），`,
        `// 因此校验是显式规则函数：`,
        `function validateStep(step, values) {`,
        `  const errors = {};`,
        `  if (step === 0 && values.project.trim().length < 2) errors.project = '项目名至少 2 个字';`,
        `  return errors;   // 直接喂给各输入框的 error 属性，Next 由 Object.keys(errors).length 门控`,
        `}`,
        ``,
        `// dayjs 负责真实格式化`,
        `dayjs().add(weeks, 'week').format('YYYY 年 M 月 D 日')`,
      ].join('\n'),
    [],
  );

  return (
    <Lab
      title="Mantine：Stepper 驱动的多步表单"
      badge={<span className="demo-live-badge">Mantine 7.15 · {mode === 'dark' ? '深色' : '浅色'}</span>}
      reset={() => {
        setActive(0);
        setValues(INITIAL);
        setSubmitted(false);
      }}
    >
      <div className="lab-mantine-root">
        <div className="lab-mantine-head">
          <Progress value={((active + 1) / 3) * 100} size="sm" radius="xl" />
          <div className="lab-mantine-head__meta">
            <span>
              第 {active + 1} / 3 步 · 完成度 {Math.round(((active + 1) / 3) * 100)}%
            </span>
            {narrow ? <span>窄屏：控件改为纵向排列</span> : <span>宽屏：控件双列</span>}
          </div>
        </div>

        <Stepper active={active} onStepClick={setActive} orientation="vertical" size="xs" allowNextStepsSelect={false}>
          <Stepper.Step label="基本信息" description="项目与容量预估">
            <Group grow={!narrow} align="flex-start">
              <TextInput
                label="项目名称"
                placeholder="例如：风控规则中心"
                value={values.project}
                error={errors.project}
                onChange={(e) => patch('project', e.currentTarget.value)}
              />
              <TextInput
                label="联系邮箱"
                placeholder="ops@example.com"
                value={values.email}
                error={errors.email}
                onChange={(e) => patch('email', e.currentTarget.value)}
              />
            </Group>
            <NumberInput
              mt="sm"
              label="并发预估（QPS）"
              min={1}
              max={100000}
              value={values.concurrency}
              error={errors.concurrency}
              onChange={(v) => patch('concurrency', v)}
            />
          </Stepper.Step>

          <Stepper.Step label="团队配置" description="区域、实例与灰度">
            <Group grow={!narrow} align="flex-start">
              <Select
                label="部署区域"
                placeholder="选择区域"
                data={['华东-杭州', '华北-北京', '华南-深圳', '西南-成都']}
                value={values.region}
                error={errors.region}
                onChange={(v) => patch('region', v)}
              />
              <NumberInput
                label="实例数"
                min={1}
                max={20}
                value={values.instances}
                error={errors.instances}
                onChange={(v) => patch('instances', v)}
              />
            </Group>
            <Group mt="sm" align="flex-start">
              <Checkbox
                label="开启灰度发布"
                checked={values.canary}
                onChange={(e) => patch('canary', e.currentTarget.checked)}
              />
              <NumberInput
                label="灰度比例 (%)"
                min={0}
                max={100}
                w={160}
                disabled={!values.canary}
                value={values.canaryRatio}
                error={errors.canaryRatio}
                onChange={(v) => patch('canaryRatio', Number(v) || 0)}
              />
            </Group>
            <Checkbox
              mt="sm"
              label="开启监控告警"
              checked={values.monitoring}
              onChange={(e) => patch('monitoring', e.currentTarget.checked)}
            />
          </Stepper.Step>

          <Stepper.Step label="确认提交" description="核对清单">
            <div className="lab-mantine-summary">
              <div>
                <span>项目</span>
                <strong>{values.project || '—'}</strong>
              </div>
              <div>
                <span>联系邮箱</span>
                <strong>{values.email || '—'}</strong>
              </div>
              <div>
                <span>区域 / 实例</span>
                <strong>
                  {values.region ?? '—'} · {String(values.instances)}
                </strong>
              </div>
              <div>
                <span>总容量</span>
                <strong>{plan.capacity.toLocaleString('zh-CN')} QPS</strong>
              </div>
              <div>
                <span>灰度</span>
                <strong>{values.canary ? `${values.canaryRatio}%` : '未开启'}</strong>
              </div>
              <div>
                <span>申请单号（dayjs 生成）</span>
                <strong>{plan.id}</strong>
              </div>
              <div>
                <span>预计上线（dayjs 计算）</span>
                <strong>{plan.launch}</strong>
              </div>
              <div>
                <span>生成时间</span>
                <strong>{plan.builtAt}</strong>
              </div>
            </div>
            <Checkbox
              mt="sm"
              label="我已确认上述配置"
              checked={values.agree}
              error={errors.agree}
              onChange={(e) => patch('agree', e.currentTarget.checked)}
            />
          </Stepper.Step>
        </Stepper>

        <Divider my="sm" color={accent} />

        {errorList.length > 0 ? (
          <Alert color="red" variant="light" title={`当前步骤有 ${errorList.length} 处未通过校验`} mb="sm">
            <Stack gap={2}>
              {errorList.map(([key, message]) => (
                <span key={key}>
                  <code>{key}</code> · {message}
                </span>
              ))}
            </Stack>
          </Alert>
        ) : (
          <Alert color="teal" variant="light" title="本步骤校验通过" mb="sm">
            <span>下一步按钮已解锁。</span>
          </Alert>
        )}

        <Group justify="space-between">
          <Button variant="default" size="xs" disabled={active === 0} onClick={() => setActive((s) => Math.max(0, s - 1))}>
            上一步
          </Button>
          {active < 2 ? (
            <Button size="xs" disabled={!canGoNext} onClick={() => setActive((s) => Math.min(2, s + 1))}>
              下一步
            </Button>
          ) : (
            <Button size="xs" disabled={!canGoNext || submitted} onClick={() => setSubmitted(true)}>
              提交申请
            </Button>
          )}
        </Group>

        {submitted ? (
          <Status tone="ok">
            已在本页生成申请单 {plan.id}（纯前端演示，没有发出任何网络请求）。
          </Status>
        ) : (
          <Status>
            Stepper 的 <code>active</code> 是受控的：点「上一步」不会丢失已填内容。
          </Status>
        )}
      </div>

      <Code text={snippet} onCopy={onCopy} label="Mantine 调用" />
    </Lab>
  );
}
