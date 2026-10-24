import { LabControls } from '../lab-kit';
import { useEffect, useMemo, useState, type Key } from 'react';
import { ConfigProvider, Table, Tag, theme as antdTheme, type TableColumnsType } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import '../styles/antd.css';
import type { DemoCopyHandler } from '../types';
import { Code, Lab, Status, useThemeColors } from '../lab-kit';
import { seeded } from '../lab-kit';

/* ------------------------------------------------------------------ *
 * Ant Design Table: the parts that actually take effort to hand-roll —
 * column filters (multi-dimension), comparators, pagination config,
 * row selection and expanded rows — over 60 real fixture rows.
 * ------------------------------------------------------------------ */

interface TicketRow {
  key: string;
  id: string;
  title: string;
  team: '平台' | '交易' | '增长' | '数据';
  city: string;
  priority: 'P0' | 'P1' | 'P2';
  status: '待处理' | '处理中' | '已上线';
  reporter: string;
  createdAt: string;
  score: number;
  logs: { time: string; actor: string; note: string }[];
}

const TEAMS = ['平台', '交易', '增长', '数据'] as const;
const CITIES = ['杭州', '北京', '深圳', '成都', '上海'];
const PEOPLE = ['林岚', '周叙', '陈默', '苏白', '何予', '柳青'];
const TITLES = [
  '订单列表分页错乱',
  '优惠券叠加规则冲突',
  '埋点字段缺失',
  '导出报表超时',
  '登录风控误拦截',
  '消息推送重复到达',
  '灰度开关未生效',
  '库存回写延迟',
  '搜索召回为空',
  '图表颜色对比不足',
];

const STATUS_COLOR: Record<TicketRow['status'], string> = {
  待处理: 'volcano',
  处理中: 'gold',
  已上线: 'green',
};

const ROWS: TicketRow[] = (() => {
  const rand = seeded(20241019);
  return Array.from({ length: 60 }, (_, i) => {
    const day = 1 + Math.floor(rand() * 28);
    const hour = Math.floor(rand() * 24);
    return {
      key: `row-${i}`,
      id: `TK-${2000 + i}`,
      title: TITLES[i % TITLES.length],
      team: TEAMS[i % TEAMS.length],
      city: CITIES[Math.floor(rand() * CITIES.length)],
      priority: (['P0', 'P1', 'P2'] as const)[Math.floor(rand() * 3)],
      status: (['待处理', '处理中', '已上线'] as const)[Math.floor(rand() * 3)],
      reporter: PEOPLE[Math.floor(rand() * PEOPLE.length)],
      createdAt: `2024-10-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:00`,
      score: Math.floor(rand() * 100),
      logs: [
        { time: '09:12', actor: PEOPLE[i % PEOPLE.length], note: '已在复现环境确认，附日志片段。' },
        { time: '11:40', actor: PEOPLE[(i + 2) % PEOPLE.length], note: '定位到缓存键拼接错误，等待合并修复。' },
        { time: '15:03', actor: PEOPLE[(i + 4) % PEOPLE.length], note: '修复已合入预发环境，等待灰度。' },
      ],
    };
  });
})();

/** Reads the site's resolved theme so AntD never renders a white panel. */
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

export default function AntDesignLab({ onCopy }: { onCopy: DemoCopyHandler }) {
  const colors = useThemeColors();
  const mode = useSiteTheme();

  const [filteredCount, setFilteredCount] = useState(ROWS.length);
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [nonce, setNonce] = useState(0);

  const columns = useMemo<TableColumnsType<TicketRow>>(
    () => [
      {
        title: '工单号',
        dataIndex: 'id',
        key: 'id',
        width: 110,
        fixed: 'left',
        sorter: (a, b) => a.id.localeCompare(b.id),
      },
      {
        title: '标题',
        dataIndex: 'title',
        key: 'title',
        sorter: (a, b) => a.title.localeCompare(b.title),
      },
      {
        title: '团队',
        dataIndex: 'team',
        key: 'team',
        filters: TEAMS.map((t) => ({ text: t, value: t })),
        onFilter: (value, record) => record.team === value,
      },
      {
        title: '城市',
        dataIndex: 'city',
        key: 'city',
        filters: CITIES.map((c) => ({ text: c, value: c })),
        onFilter: (value, record) => record.city === value,
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 96,
        sorter: (a, b) => a.priority.localeCompare(b.priority),
        render: (value: TicketRow['priority']) => <Tag color={value === 'P0' ? 'red' : value === 'P1' ? 'orange' : 'default'}>{value}</Tag>,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 104,
        filters: (['待处理', '处理中', '已上线'] as const).map((s) => ({ text: s, value: s })),
        onFilter: (value, record) => record.status === value,
        render: (value: TicketRow['status']) => <Tag color={STATUS_COLOR[value]}>{value}</Tag>,
      },
      {
        title: '上报时间',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 150,
        sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
        defaultSortOrder: 'descend',
      },
      {
        title: '分数',
        dataIndex: 'score',
        key: 'score',
        width: 90,
        sorter: (a, b) => a.score - b.score,
      },
    ],
    [],
  );

  const expandedRowRender = useMemo(
    () => (record: TicketRow) => (
      <div className="lab-antd-expanded">
        <strong>{record.id} 处理记录</strong>
        <ul>
          {record.logs.map((log) => (
            <li key={log.time}>
              <code>{log.time}</code> {log.actor} · {log.note}
            </li>
          ))}
        </ul>
      </div>
    ),
    [],
  );

  const snippet = useMemo(
    () =>
      [
        `const columns: TableColumnsType<TicketRow> = [`,
        `  { title: '团队', dataIndex: 'team',`,
        `    filters: ['平台','交易','增长','数据'].map((t) => ({ text: t, value: t })),`,
        `    onFilter: (value, record) => record.team === value },   // 每个维度一份`,
        `  { title: '分数', dataIndex: 'score', sorter: (a, b) => a.score - b.score },`,
        `  { title: '上报时间', dataIndex: 'createdAt', defaultSortOrder: 'descend' },`,
        `];`,
        ``,
        `<Table<TicketRow>`,
        `  rowKey="id"`,
        `  dataSource={rows}          // 60 条本地数据`,
        `  columns={columns}`,
        `  scroll={{ x: 900 }}        // 320px 下不会撑破页面`,
        `  pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: [8, 16, 32] }}`,
        `  rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}`,
        `  expandedRowRender={(record) => <LogPanel record={record} />}`,
        `  expandable={{ defaultExpandAllRows: false }}`,
        `  onChange={(pagination, _filters, _sorter, extra) => setFilteredCount(extra.currentDataSource.length)}`,
        `  locale={zhCN}`,
        `/>`,
      ].join('\n'),
    [],
  );

  return (
    <Lab
      title="Ant Design：表格的筛选、排序与分页"
      badge={<span className="demo-live-badge">antd 5.22 · {mode === 'dark' ? '深色' : '浅色'}</span>}
      reset={() => {
        setFilteredCount(ROWS.length);
        setSelectedKeys([]);
        // Remount the Table so its internal filter/sort state really resets.
        setNonce((n) => n + 1);
      }}
    >
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: colors.accent ?? '#d95a3f',
            colorBgBase: colors.surface ?? '#fffdf9',
            colorTextBase: colors.ink ?? '#211f1b',
            borderRadius: 10,
            fontFamily: 'var(--font-sans)',
          },
        }}
      >
        <div className="lab-layout">
          <LabControls className="lab-controls">
            <p className="demo-caption">
              表头筛选是多个独立维度，可叠加；「当前命中行数」来自 Table 的 onChange 回调里的
              <code> extra.currentDataSource </code>，不是自己算的。
            </p>
            <Status tone={filteredCount === ROWS.length ? undefined : 'warn'}>
              数据源 {ROWS.length} 行 · 当前命中 <b>{filteredCount}</b> 行 · 已选 {selectedKeys.length} 行
            </Status>
            <p className="lab-field__rule">
              表格设置了 <code>scroll={'{ x: 900 }'}</code>，在 320px 宽度下横向滚动而不会让整页溢出。
            </p>
          </LabControls>

          <div className="lab-stage lab-stage--table">
            <Table<TicketRow>
              key={nonce}
              size="small"
              rowKey="id"
              dataSource={ROWS}
              columns={columns}
              scroll={{ x: 900 }}
              expandedRowRender={expandedRowRender}
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys),
              }}
              pagination={{
                pageSize: 8,
                showSizeChanger: true,
                pageSizeOptions: [8, 16, 32],
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
              }}
              onChange={(_pagination, _filters, _sorter, extra) =>
                setFilteredCount(extra.currentDataSource.length)
              }
            />
          </div>
        </div>

        <Code text={snippet} onCopy={onCopy} label="antd 调用" />
      </ConfigProvider>
    </Lab>
  );
}
