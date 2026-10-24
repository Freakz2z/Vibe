import { LabControls } from '../lab-kit';
import { useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, prettyJSON, Status, useThemeColors } from '../lab-kit';

/* ------------------------------------------------------------------ *
 * One real schema with nested objects, an array, an enum and a refine.
 * Everything shown on screen comes from Zod itself:
 *   safeParse() → success | { error }
 *   error.issues → each with a real `path: (string | number)[]`
 *   error.flatten() → { formErrors, fieldErrors }
 *   error.format()  → nested tree with message + nested fieldErrors
 * ------------------------------------------------------------------ */

const RoleSchema = z.enum(['engineer', 'designer', 'pm', 'qa'], {
  errorMap: () => ({ message: '角色必须是 engineer / designer / pm / qa 之一' }),
});

const ContactSchema = z.object({
  type: z.enum(['phone', 'email'], { errorMap: () => ({ message: '联系方式类型非法' }) }),
  value: z.string().min(5, '联系方式至少 5 个字符'),
});

export const RegisterSchema = z
  .object({
    username: z
      .string()
      .min(3, '用户名至少 3 个字符')
      .max(16, '用户名最多 16 个字符')
      .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符'),
    email: z.string().email('邮箱格式不正确'),
    age: z
      .number({ invalid_type_error: '年龄必须是数字' })
      .int('年龄必须是整数')
      .min(18, '未满 18 岁不能注册')
      .max(60, '超过 60 岁不能注册'),
    role: RoleSchema,
    headline: z.string().min(4, '一句话介绍至少 4 个字').max(30, '一句话介绍最多 30 个字'),
    newsletter: z.boolean(),
    address: z.object({
      city: z.string().min(2, '城市名至少 2 个字'),
      district: z.string().min(2, '区名至少 2 个字'),
    }),
    contacts: z.array(ContactSchema).min(1, '至少保留一个联系方式').max(2, '最多保留两个联系方式'),
  })
  .refine((value) => !value.newsletter || value.headline.trim().length >= 6, {
    message: '订阅通讯就必须写一句像样的介绍（≥6 字）',
    path: ['headline'],
  });

type RegisterInput = z.input<typeof RegisterSchema>;

interface RawInput {
  username: string;
  email: string;
  age: string;
  role: string;
  headline: string;
  newsletter: boolean;
  city: string;
  district: string;
  contacts: { type: string; value: string }[];
}

const INITIAL: RawInput = {
  username: 'lin_lan',
  email: 'lin@example.com',
  age: '29',
  role: 'engineer',
  headline: '前端工程',
  newsletter: false,
  city: '杭州',
  district: '西湖',
  contacts: [{ type: 'phone', value: '13800000000' }],
};

/** Turn a path array into the flat key the form uses. */
function pathKey(path: (string | number)[]): string {
  return path.join('.');
}

export default function ZodLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const [raw, setRaw] = useState<RawInput>(INITIAL);

  /* NaN reaches z.number() as a real invalid_type_error, which is exactly the
     issue code this demo wants to surface — so no pre-validation happens here. */
  const input = useMemo<RegisterInput>(() => {
    return {
      username: raw.username,
      email: raw.email,
      age: raw.age.trim() === '' ? Number.NaN : Number(raw.age),
      role: raw.role as RegisterInput['role'],
      headline: raw.headline,
      newsletter: raw.newsletter,
      address: { city: raw.city, district: raw.district },
      contacts: raw.contacts.map((c) => ({ type: c.type as 'phone' | 'email', value: c.value })),
    };
  }, [raw]);

  /* The single source of truth on screen: one safeParse per keystroke. */
  const result = useMemo(() => RegisterSchema.safeParse(input), [input]);

  /** Real field errors keyed by issue.path.join('.') — nested + indexed. */
  const fieldErrors = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (result.success) return map;
    for (const issue of result.error.issues) {
      const key = pathKey(issue.path);
      (map[key] ??= []).push(issue.message);
    }
    return map;
  }, [result]);

  const flattened = useMemo(
    () => (result.success ? null : result.error.flatten()),
    [result],
  );
  const formatted = useMemo(
    () => (result.success ? null : result.error.format()),
    [result],
  );
  const issueView = useMemo(
    () =>
      result.success
        ? []
        : result.error.issues.slice(0, 6).map((issue) => ({
            path: issue.path,
            code: issue.code,
            message: issue.message,
          })),
    [result],
  );

  const set = <K extends keyof RawInput>(key: K, value: RawInput[K]) =>
    setRaw((prev) => ({ ...prev, [key]: value }));

  const errorText = (key: string) => fieldErrors[key]?.[0] ?? '';
  const errorCount = result.success ? 0 : result.error.issues.length;

  const snippet = useMemo(
    () =>
      [
        `const RegisterSchema = z.object({`,
        `  username: z.string().min(3, '用户名至少 3 个字符').regex(/^[a-zA-Z0-9_-]+$/, /* … */),`,
        `  email: z.string().email('邮箱格式不正确'),`,
        `  age: z.number().int().min(18, '未满 18 岁不能注册'),`,
        `  role: z.enum(['engineer', 'designer', 'pm', 'qa'], { errorMap: () => ({ message: '…' }) }),`,
        `  address: z.object({ city: z.string().min(2, /* … */), district: z.string().min(2, /* … */) }),`,
        `  contacts: z.array(z.object({ type: z.enum(['phone','email']), value: z.string().min(5, /* … */) })).min(1, /* … */),`,
        `}).refine((v) => !v.newsletter || v.headline.trim().length >= 6, {`,
        `  message: '订阅通讯就必须写一句像样的介绍（≥6 字）',`,
        `  path: ['headline'],          // refine 也可以指定 path`,
        `});`,
        ``,
        `// 每次输入都跑一次 safeParse，永远不抛异常`,
        `const result = RegisterSchema.safeParse(input);`,
        `if (!result.success) {`,
        `  for (const issue of result.error.issues) {`,
        `    const key = issue.path.join('.');  // 'address.city' / 'contacts.0.value'`,
        `    setFieldError(key, issue.message);`,
        `  }`,
        `}`,
      ].join('\n'),
    [],
  );

  const setBroken = (patch: Partial<RawInput>) => {
    setRaw((prev) => ({ ...prev, ...patch }));
  };

  const fields: { key: string; label: string; node: ReactNode }[] = [
    {
      key: 'username',
      label: '用户名',
      node: <input value={raw.username} onChange={(e) => set('username', e.target.value)} aria-invalid={Boolean(fieldErrors.username)} />,
    },
    {
      key: 'email',
      label: '邮箱',
      node: <input value={raw.email} onChange={(e) => set('email', e.target.value)} aria-invalid={Boolean(fieldErrors.email)} />,
    },
    {
      key: 'age',
      label: '年龄（故意留空即可触发 invalid_type_error）',
      node: <input value={raw.age} onChange={(e) => set('age', e.target.value)} aria-invalid={Boolean(fieldErrors.age)} />,
    },
    {
      key: 'role',
      label: '角色（手输非法值可触发 invalid_enum）',
      node: <input value={raw.role} onChange={(e) => set('role', e.target.value)} aria-invalid={Boolean(fieldErrors.role)} />,
    },
    {
      key: 'headline',
      label: '一句话介绍',
      node: <input value={raw.headline} onChange={(e) => set('headline', e.target.value)} aria-invalid={Boolean(fieldErrors.headline)} />,
    },
    {
      key: 'address.city',
      label: '城市（address.city）',
      node: <input value={raw.city} onChange={(e) => set('city', e.target.value)} aria-invalid={Boolean(fieldErrors['address.city'])} />,
    },
    {
      key: 'address.district',
      label: '区（address.district）',
      node: <input value={raw.district} onChange={(e) => set('district', e.target.value)} aria-invalid={Boolean(fieldErrors['address.district'])} />,
    },
  ];

  return (
    <Lab
      title="Zod：safeParse 与真实 error.issues"
      badge={<span className="demo-live-badge">Zod 3.23</span>}
      reset={() => setRaw(INITIAL)}
    >
      <div className="lab-layout">
        <LabControls className="lab-controls" mode="inline">
          <p className="demo-caption">
            每次按键都会跑一次 <code>safeParse</code>；右侧的每条消息与 path 都直接来自 Zod，未经加工。
          </p>
          <div className="lab-zod-presets">
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setBroken({ username: 'ab', email: 'lin@@example', age: '17.5', role: 'architect' })}
            >
              制造 4 个错误
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setBroken({ city: '杭', district: '' })}
            >
              只错在 address.*
            </button>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setBroken({ newsletter: true, headline: '前端' })}
            >
              只触发 refine
            </button>
            <button type="button" className="button button--secondary button--small" onClick={() => setRaw(INITIAL)}>
              恢复合法数据
            </button>
          </div>
          <div className="lab-field__rule">
            contacts 支持增删，用来演示数组下标 path（contacts.0.value）。
          </div>
          {raw.contacts.map((contact, index) => (
            <div key={index} className="lab-zod-contact">
              <label className="lab-field">
                <span>联系方式 {index} 类型</span>
                <select
                  value={contact.type}
                  onChange={(e) =>
                    setRaw((prev) => ({
                      ...prev,
                      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, type: e.target.value } : c)),
                    }))
                  }
                >
                  <option value="phone">phone</option>
                  <option value="email">email</option>
                  <option value="fax">fax（非法）</option>
                </select>
              </label>
              <label className="lab-field">
                <span>联系方式 {index} 值</span>
                <input
                  value={contact.value}
                  onChange={(e) =>
                    setRaw((prev) => ({
                      ...prev,
                      contacts: prev.contacts.map((c, i) => (i === index ? { ...c, value: e.target.value } : c)),
                    }))
                  }
                />
              </label>
              <p className="lab-field__error" data-invalid={Boolean(fieldErrors[`contacts.${index}.value`])}>
                {errorText(`contacts.${index}.value`) || errorText(`contacts.${index}.type`)}
              </p>
              {raw.contacts.length > 1 ? (
                <button
                  type="button"
                  className="lab-zustand-step"
                  aria-label={`删除联系方式 ${index}`}
                  onClick={() =>
                    setRaw((prev) => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== index) }))
                  }
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <div className="lab-options">
            <button
              type="button"
              className="button button--secondary button--small"
              disabled={raw.contacts.length >= 2}
              onClick={() => setRaw((prev) => ({ ...prev, contacts: [...prev.contacts, { type: 'email', value: '' }] }))}
            >
              增加一个联系方式
            </button>
          </div>
          <label className="lab-option">
            <input type="checkbox" checked={raw.newsletter} onChange={(e) => set('newsletter', e.target.checked)} />
            <span>订阅通讯（会触发 refine 规则）</span>
          </label>
          <Status tone={result.success ? 'ok' : 'warn'}>
            {result.success ? `校验通过，解析出 ${Object.keys(result.data).length} 个顶层字段。` : `校验失败，共 ${errorCount} 条 issue。`}
          </Status>
        </LabControls>

        <div className="lab-stage">
          <div className="lab-zod-form">
            {fields.map((field) => (
              <label key={field.key} className="lab-field">
                <span>
                  {field.label} <code>{field.key}</code>
                </span>
                {field.node}
                <p className="lab-field__error" data-invalid={Boolean(fieldErrors[field.key])}>
                  {errorText(field.key) || ' '}
                </p>
              </label>
            ))}
          </div>

          {result.success ? (
            <div className="lab-zod-ok" style={{ borderColor: colors['line-strong'] ?? '#ccc' }}>
              <strong>safeParse 返回 success:true</strong>
              <pre>{prettyJSON(result.data)}</pre>
            </div>
          ) : (
            <>
              <div className="lab-zod-issues">
                <div className="lab-zod-issues__head">
                  <span>error.issues（截取前 {issueView.length} 条，共 {errorCount} 条）</span>
                  <span>path 是数组，展开即可看到下标与嵌套层级</span>
                </div>
                <div className="lab-table-wrap">
                  <table className="lab-table">
                    <thead>
                      <tr>
                        <th scope="col">path.join('.')</th>
                        <th scope="col">code</th>
                        <th scope="col">message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {issueView.map((issue, i) => (
                        <tr key={`${issue.code}-${i}`}>
                          <td>
                            <code>{issue.path.length === 0 ? '(根)' : pathKey(issue.path)}</code>
                          </td>
                          <td>
                            <code>{issue.code}</code>
                          </td>
                          <td>{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Code text={prettyJSON(issueView, 2600)} onCopy={onCopy} label="原始 issue 对象" maxHeight={220} />

              <div className="lab-editor-grid lab-editor-grid--tight">
                <Code text={prettyJSON(flattened, 2200)} onCopy={onCopy} label="error.flatten()" maxHeight={260} />
                <Code text={prettyJSON(formatted, 2200)} onCopy={onCopy} label="error.format()" maxHeight={260} />
              </div>
            </>
          )}
        </div>
      </div>

      <Code text={snippet} onCopy={onCopy} label="Zod 调用" />
    </Lab>
  );
}
