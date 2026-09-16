import React, { FC, ReactNode, useEffect, useMemo, useState } from 'react'
import {
  AlignLeftOutlined,
  BarChartOutlined,
  HomeOutlined,
  LineChartOutlined,
  Loading3QuartersOutlined,
  MoreOutlined,
  PieChartOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { Button, Empty, Pagination, Spin } from 'antd'
import { useRequest } from 'ahooks'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import useGetComponentInfo from '../../../hooks/useGetComponentInfo'
import useGetPageInfo from '../../../hooks/useGetPageInfo'
import { ComponentInfoType } from '../../../store/componentsReducer'
import { getComponentStatService, getQuestionStatListService } from '../../../services/stat'
import { STAT_COLORS } from '../../../constant'
import AllQuestionsSummary from './AllQuestionsSummary'

import styles from './MobileStatView.module.scss'

type StatItem = {
  name: string
  count: number
}

type ResponseRow = {
  _id?: string
  [key: string]: unknown
}

type ChartMode = 'pie' | 'donut' | 'column' | 'bar' | 'line' | 'none'

type ChartModeOption = {
  key: ChartMode
  label: string
  icon: ReactNode
}

const CHART_MODES: ChartModeOption[] = [
  { key: 'pie', label: '饼状', icon: <PieChartOutlined /> },
  { key: 'donut', label: '圆环', icon: <Loading3QuartersOutlined /> },
  { key: 'column', label: '柱状', icon: <BarChartOutlined /> },
  { key: 'bar', label: '条形', icon: <AlignLeftOutlined /> },
  { key: 'line', label: '折线', icon: <LineChartOutlined /> },
  { key: 'none', label: '隐藏', icon: <StopOutlined /> },
]

const ANSWER_COMPONENT_TYPES = [
  'questionInput',
  'questionTextarea',
  'questionRadio',
  'questionCheckbox',
]
const CHOICE_COMPONENT_TYPES = ['questionRadio', 'questionCheckbox']
const DETAIL_PAGE_SIZE = 10

function getQuestionTitle(component: ComponentInfoType) {
  const props = component.props as { title?: string }
  return props.title || component.title || '未命名题目'
}

function getQuestionNumber(component: ComponentInfoType, fallback: number) {
  const questionNumber = (component as ComponentInfoType & { questionNumber?: number })
    .questionNumber
  return Number.isFinite(questionNumber) ? questionNumber : fallback
}

function getQuestionTypeLabel(type: string) {
  if (type === 'questionCheckbox') return '多选题'
  if (type === 'questionRadio') return '单选题'
  if (type === 'questionTextarea') return '开放题'
  return '填空题'
}

function getConfiguredOptionNames(component: ComponentInfoType) {
  const props = component.props as {
    options?: Array<{ text?: string }>
    list?: Array<{ text?: string }>
  }
  const options = component.type === 'questionCheckbox' ? props.list : props.options

  return (options || []).map(option => option.text || '').filter(Boolean)
}

function toStatItems(value: unknown): StatItem[] {
  if (!Array.isArray(value)) return []

  return value
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const record = item as { name?: unknown; count?: unknown }
      return {
        name: String(record.name || '未命名选项'),
        count: Number(record.count) || 0,
      }
    })
}

const MobileStatView: FC = () => {
  const nav = useNavigate()
  const { id = '' } = useParams()
  const { title } = useGetPageInfo()
  const { componentList } = useGetComponentInfo()

  const [activeTab, setActiveTab] = useState<'summary' | 'result' | 'detail'>('summary')
  const [selectedQuestionId, setSelectedQuestionId] = useState('')
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false)
  const [chartMode, setChartMode] = useState<ChartMode>('pie')
  const [stat, setStat] = useState<StatItem[]>([])
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [responseTotal, setResponseTotal] = useState(0)
  const [detailPage, setDetailPage] = useState(1)

  const questionComponents = useMemo(
    () =>
      componentList.filter(
        component => !component.isHidden && ANSWER_COMPONENT_TYPES.includes(component.type)
      ),
    [componentList]
  )

  const selectedQuestion =
    questionComponents.find(component => component.fe_id === selectedQuestionId) ||
    questionComponents[0]
  const isChoiceQuestion = Boolean(
    selectedQuestion && CHOICE_COMPONENT_TYPES.includes(selectedQuestion.type)
  )

  const { loading: statLoading, run: loadStat } = useRequest(
    async (componentId: string) => await getComponentStatService(id, componentId),
    {
      manual: true,
      onSuccess(res) {
        setStat(toStatItems(res.stat))
      },
    }
  )

  const { loading: detailLoading, run: loadResponses } = useRequest(
    async (page: number) =>
      await getQuestionStatListService(id, { page, pageSize: DETAIL_PAGE_SIZE }),
    {
      manual: true,
      onSuccess(res) {
        setResponseTotal(Number(res.total) || 0)
        setResponses(Array.isArray(res.list) ? res.list : [])
      },
    }
  )

  useEffect(() => {
    if (!selectedQuestion || !CHOICE_COMPONENT_TYPES.includes(selectedQuestion.type)) {
      setStat([])
      return
    }
    loadStat(selectedQuestion.fe_id)
  }, [id, selectedQuestion?.fe_id])

  useEffect(() => {
    loadResponses(detailPage)
  }, [id, detailPage])

  const tableData = useMemo(() => {
    if (!selectedQuestion || !CHOICE_COMPONENT_TYPES.includes(selectedQuestion.type)) return []

    const configuredNames = getConfiguredOptionNames(selectedQuestion)
    const names = configuredNames.length > 0 ? configuredNames : stat.map(item => item.name)
    const countByName = new Map(stat.map(item => [item.name, item.count]))

    return names.map(name => ({ name, count: countByName.get(name) || 0 }))
  }, [selectedQuestion, stat])

  const optionCountTotal = useMemo(
    () => tableData.reduce((sum, item) => sum + item.count, 0),
    [tableData]
  )
  const validCount =
    selectedQuestion?.type === 'questionCheckbox' && responseTotal > 0
      ? responseTotal
      : optionCountTotal

  const selectedQuestionIndex = Math.max(
    questionComponents.findIndex(component => component.fe_id === selectedQuestion?.fe_id),
    0
  )
  const selectedQuestionNumber = selectedQuestion
    ? getQuestionNumber(selectedQuestion, selectedQuestionIndex + 1)
    : selectedQuestionIndex + 1

  function formatPercentage(count: number) {
    if (validCount === 0) return '0%'
    return `${Math.round((count / validCount) * 100)}%`
  }

  function renderChart() {
    if (chartMode === 'none') return null
    if (tableData.length === 0) return <Empty description="暂无图表数据" />

    if (chartMode === 'pie' || chartMode === 'donut')
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={tableData}
              dataKey="count"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={chartMode === 'donut' ? 48 : 0}
              outerRadius={82}
              paddingAngle={2}
            >
              {tableData.map((item, index) => (
                <Cell key={item.name} fill={STAT_COLORS[index % STAT_COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip />
          </PieChart>
        </ResponsiveContainer>
      )

    if (chartMode === 'bar')
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={tableData}
            layout="vertical"
            margin={{ top: 12, right: 24, bottom: 12, left: 8 }}
          >
            <CartesianGrid stroke="#eef0f3" strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 12 }} />
            <ChartTooltip />
            <Bar dataKey="count" fill="#4d9ff7" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )

    if (chartMode === 'line')
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tableData} margin={{ top: 18, right: 24, bottom: 12, left: 0 }}>
            <CartesianGrid stroke="#eef0f3" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <ChartTooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#4d9ff7"
              strokeWidth={3}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={tableData} margin={{ top: 18, right: 24, bottom: 12, left: 0 }}>
          <CartesianGrid stroke="#eef0f3" strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} />
          <ChartTooltip />
          <Bar dataKey="count" fill="#4d9ff7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  function renderResult() {
    if (!selectedQuestion)
      return (
        <div className={styles.emptyState}>
          <Empty description="暂无问卷题目" />
        </div>
      )

    return (
      <>
        <section className={styles.surveyHeading}>
          <h2>{title || '问卷统计'}</h2>
        </section>

        <section className={styles.questionSection}>
          <div className={styles.questionMeta}>
            <strong>第{selectedQuestionNumber}题：</strong>
            <span>{getQuestionTitle(selectedQuestion)}</span>
            <em>[{getQuestionTypeLabel(selectedQuestion.type)}]</em>
          </div>

          {!isChoiceQuestion ? (
            <div className={styles.emptyState}>
              <Empty description="开放题无汇总统计" />
            </div>
          ) : statLoading ? (
            <div className={styles.loadingState}>
              <Spin />
            </div>
          ) : (
            <>
              <div className={styles.tableScroller}>
                <table className={styles.statTable}>
                  <thead>
                    <tr>
                      <th>选项</th>
                      <th>小计</th>
                      <th>比例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map(item => (
                      <tr key={item.name}>
                        <td>{item.name}</td>
                        <td>{item.count}</td>
                        <td>{formatPercentage(item.count)}</td>
                      </tr>
                    ))}
                    <tr className={styles.totalRow}>
                      <td>本题有效填写人次</td>
                      <td>{validCount}</td>
                      <td>{validCount > 0 ? '100%' : '0%'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.chartToolbar} role="toolbar" aria-label="图表类型">
                {CHART_MODES.map(mode => (
                  <button
                    key={mode.key}
                    type="button"
                    className={
                      chartMode === mode.key ? styles.chartButtonActive : styles.chartButton
                    }
                    aria-label={`${mode.label}图`}
                    aria-pressed={chartMode === mode.key}
                    title={`${mode.label}图`}
                    onClick={() => setChartMode(mode.key)}
                  >
                    {mode.icon}
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>

              {chartMode !== 'none' && <div className={styles.chartViewport}>{renderChart()}</div>}
            </>
          )}
        </section>
      </>
    )
  }

  function renderDetails() {
    if (!selectedQuestion) return <Empty description="暂无答卷数据" />

    return (
      <section className={styles.detailSection}>
        <div className={styles.detailHeading}>
          <div>
            <span>第{selectedQuestionNumber}题</span>
            <h2>{getQuestionTitle(selectedQuestion)}</h2>
          </div>
          <strong>共 {responseTotal} 份</strong>
        </div>

        {detailLoading ? (
          <div className={styles.loadingState}>
            <Spin />
          </div>
        ) : (
          <div className={styles.tableScroller}>
            <table className={styles.detailTable}>
              <thead>
                <tr>
                  <th>序号</th>
                  <th>答题内容</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((response, index) => (
                  <tr key={response._id || index}>
                    <td>{(detailPage - 1) * DETAIL_PAGE_SIZE + index + 1}</td>
                    <td>{String(response[selectedQuestion.fe_id] || '未填写')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {responseTotal > DETAIL_PAGE_SIZE && (
          <div className={styles.detailPagination}>
            <Pagination
              current={detailPage}
              pageSize={DETAIL_PAGE_SIZE}
              total={responseTotal}
              showSizeChanger={false}
              size="small"
              responsive={false}
              onChange={setDetailPage}
            />
          </div>
        )}
      </section>
    )
  }

  return (
    <div className={styles.mobilePage}>
      <header className={styles.topBar}>
        <Button
          type="text"
          className={styles.homeButton}
          icon={<HomeOutlined />}
          aria-label="返回问卷列表"
          onClick={() => nav('/manage/list')}
        />
        <h1>统计结果</h1>
        <Button
          type="text"
          className={styles.headerMoreButton}
          icon={<MoreOutlined />}
          aria-label="选择题目"
          aria-expanded={isQuestionPickerOpen}
          onClick={() => setIsQuestionPickerOpen(value => !value)}
        />
      </header>

      <nav className={styles.tabBar} aria-label="统计视图">
        <button
          type="button"
          className={activeTab === 'summary' ? styles.activeTab : styles.tab}
          aria-current={activeTab === 'summary' ? 'page' : undefined}
          onClick={() => setActiveTab('summary')}
        >
          全部题目
        </button>
        <button
          type="button"
          className={activeTab === 'result' ? styles.activeTab : styles.tab}
          aria-current={activeTab === 'result' ? 'page' : undefined}
          onClick={() => setActiveTab('result')}
        >
          单题统计
        </button>
        <button
          type="button"
          className={activeTab === 'detail' ? styles.activeTab : styles.tab}
          aria-current={activeTab === 'detail' ? 'page' : undefined}
          onClick={() => setActiveTab('detail')}
        >
          详细数据
        </button>
        <button
          type="button"
          className={styles.questionPickerButton}
          aria-label="切换题目"
          aria-expanded={isQuestionPickerOpen}
          onClick={() => setIsQuestionPickerOpen(value => !value)}
        >
          <MoreOutlined />
        </button>
      </nav>

      {isQuestionPickerOpen && (
        <div className={styles.questionPicker}>
          {questionComponents.map((component, index) => (
            <button
              key={component.fe_id}
              type="button"
              aria-pressed={component.fe_id === selectedQuestion?.fe_id}
              className={
                component.fe_id === selectedQuestion?.fe_id
                  ? styles.selectedQuestionButton
                  : styles.questionButton
              }
              onClick={() => {
                setSelectedQuestionId(component.fe_id)
                setDetailPage(1)
                setActiveTab(CHOICE_COMPONENT_TYPES.includes(component.type) ? 'result' : 'detail')
                setIsQuestionPickerOpen(false)
              }}
            >
              <span>第{getQuestionNumber(component, index + 1)}题</span>
              {getQuestionTitle(component)}
            </button>
          ))}
        </div>
      )}

      <main className={activeTab === 'summary' ? styles.summaryContent : styles.content}>
        {activeTab === 'summary' ? <AllQuestionsSummary /> : null}
        {activeTab === 'result' ? renderResult() : null}
        {activeTab === 'detail' ? renderDetails() : null}
      </main>
    </div>
  )
}

export default MobileStatView
