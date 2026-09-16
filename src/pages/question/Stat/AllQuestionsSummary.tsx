import React, { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { Button, Empty, Spin } from 'antd'
import { useParams } from 'react-router-dom'

import useGetComponentInfo from '../../../hooks/useGetComponentInfo'
import { ComponentInfoType } from '../../../store/componentsReducer'
import { getQuestionStatSummaryService } from '../../../services/stat'

import styles from './AllQuestionsSummary.module.scss'

const ANSWER_COMPONENT_TYPES = [
  'questionInput',
  'questionTextarea',
  'questionRadio',
  'questionCheckbox',
]
const CHOICE_COMPONENT_TYPES = ['questionRadio', 'questionCheckbox']

export type SummaryStatItem = {
  name: string
  count: number
}

export type SummaryQuestion = ComponentInfoType & {
  questionNumber?: number
  sectionId?: string
}

export type QuestionSummaryPayload = {
  total?: number
  stats?: Record<string, unknown>
}

export type AllQuestionsSummaryProps = {
  /** Optional when the component is rendered beneath the questionnaire route. */
  questionId?: string
  /** Pass a list to make the component reusable outside the Redux-backed stat page. */
  questions?: SummaryQuestion[]
  /** Supplying the total avoids a second request and keeps the count in sync with the page. */
  responseTotal?: number
  /** Optional loader for tests or another statistics transport. */
  loadSummary?: (questionId: string) => Promise<QuestionSummaryPayload>
  className?: string
}

function getQuestionTitle(question: SummaryQuestion) {
  const props = question.props as { title?: string }
  return props.title || question.title || '未命名题目'
}

function getQuestionNumber(question: SummaryQuestion, fallback: number) {
  return Number.isFinite(question.questionNumber) ? question.questionNumber : fallback
}

function getQuestionTypeLabel(type: string) {
  if (type === 'questionCheckbox') return '多选题'
  if (type === 'questionRadio') return '单选题'
  if (type === 'questionTextarea') return '开放题'
  return '填空题'
}

function getConfiguredOptionNames(question: SummaryQuestion) {
  const props = question.props as {
    options?: Array<{ text?: string }>
    list?: Array<{ text?: string }>
  }
  const options = question.type === 'questionCheckbox' ? props.list : props.options
  return (options || []).map(option => option.text || '').filter(Boolean)
}

export function normalizeSummaryStats(value: unknown): SummaryStatItem[] {
  if (!Array.isArray(value)) return []

  const counts = new Map<string, number>()
  value.forEach(item => {
    if (!item || typeof item !== 'object') return
    const record = item as { name?: unknown; count?: unknown }
    const name = String(record.name || '').trim()
    if (!name) return
    const count = Number(record.count)
    counts.set(name, (counts.get(name) || 0) + (Number.isFinite(count) ? count : 0))
  })

  return Array.from(counts, ([name, count]) => ({ name, count }))
}

function toStatsRecord(value: unknown): Record<string, SummaryStatItem[]> {
  if (!value || typeof value !== 'object') return {}
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, SummaryStatItem[]>>(
    (result, [id, stats]) => {
      result[id] = normalizeSummaryStats(stats)
      return result
    },
    {}
  )
}

function getConfiguredRows(question: SummaryQuestion, stats: SummaryStatItem[]) {
  const configuredNames = getConfiguredOptionNames(question)
  if (!configuredNames.length) return stats

  const countByName = new Map(stats.map(item => [item.name, item.count]))
  return configuredNames.map(name => ({ name, count: countByName.get(name) || 0 }))
}

/**
 * Dense all-question overview used by the desktop and mobile statistics pages.
 * It intentionally keeps every answer question on one scrollable page so users
 * can compare the complete questionnaire without opening a question picker.
 */
type ResolvedAllQuestionsSummaryProps = Omit<AllQuestionsSummaryProps, 'questions'> & {
  questionId: string
  questions: SummaryQuestion[]
}

const AllQuestionsSummaryContent: FC<ResolvedAllQuestionsSummaryProps> = props => {
  const {
    questionId,
    questions,
    responseTotal,
    loadSummary = getQuestionStatSummaryService,
    className,
  } = props

  const answerQuestions = useMemo(
    () =>
      questions.filter(
        question => !question.isHidden && ANSWER_COMPONENT_TYPES.includes(question.type)
      ),
    [questions]
  )
  const [statsById, setStatsById] = useState<Record<string, SummaryStatItem[]>>({})
  const [total, setTotal] = useState<number>(typeof responseTotal === 'number' ? responseTotal : 0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    if (!questionId) {
      setStatsById({})
      setTotal(typeof responseTotal === 'number' ? responseTotal : 0)
      setFailed(false)
      return
    }

    setLoading(true)
    setFailed(false)
    try {
      const payload = await loadSummary(questionId)
      setStatsById(toStatsRecord(payload && payload.stats))
      if (Number.isFinite(Number(payload?.total))) setTotal(Number(payload?.total))
      else if (typeof responseTotal === 'number') setTotal(responseTotal)
    } catch (_error) {
      setFailed(true)
      setStatsById({})
      if (typeof responseTotal === 'number') setTotal(responseTotal)
    } finally {
      setLoading(false)
    }
  }, [loadSummary, questionId, responseTotal])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (typeof responseTotal === 'number') setTotal(responseTotal)
  }, [responseTotal])

  const rootClassName = className ? `${styles.container} ${className}` : styles.container

  if (!answerQuestions.length)
    return (
      <section className={rootClassName} aria-label="全部题目统计">
        <Empty description="暂无可统计题目" />
      </section>
    )

  return (
    <section className={rootClassName} aria-label="全部题目统计">
      <header className={styles.summaryHeader}>
        <div>
          <span className={styles.eyebrow}>问卷汇总</span>
          <h2>全部题目统计</h2>
        </div>
        <div className={styles.headerMetrics}>
          <span>
            <strong>{total}</strong> 份答卷
          </span>
          <span>
            <strong>{answerQuestions.length}</strong> 道题
          </span>
        </div>
      </header>

      {failed && (
        <div className={styles.errorBanner} role="alert">
          <span>统计数据加载失败，请重试。</span>
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>
            重试
          </Button>
        </div>
      )}

      {loading && !Object.keys(statsById).length ? (
        <div className={styles.loadingState}>
          <Spin />
          <span>正在加载全部题目统计...</span>
        </div>
      ) : (
        <div className={styles.questionGrid}>
          {answerQuestions.map((question, index) => {
            const isChoice = CHOICE_COMPONENT_TYPES.includes(question.type)
            const stats = getConfiguredRows(question, statsById[question.fe_id] || [])
            const optionTotal = stats.reduce((sum, item) => sum + item.count, 0)
            // Percentages use the complete response count so single- and
            // multi-select questions are comparable even when a response is blank.
            const denominator = total || optionTotal
            const questionNumber = getQuestionNumber(question, index + 1)

            return (
              <article className={styles.questionCard} key={question.fe_id}>
                <header className={styles.questionHeader}>
                  <span className={styles.questionNumber}>{questionNumber}</span>
                  <div className={styles.questionHeading}>
                    <h3>{getQuestionTitle(question)}</h3>
                    <span>{getQuestionTypeLabel(question.type)}</span>
                  </div>
                  <strong className={styles.answerMetric}>
                    {total || optionTotal}
                    <small>人</small>
                  </strong>
                </header>

                {isChoice ? (
                  stats.length ? (
                    <div className={styles.optionTableWrapper}>
                      <table className={styles.optionTable}>
                        <thead>
                          <tr>
                            <th>选项</th>
                            <th>人数</th>
                            <th>占比</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.map(item => {
                            const percentage = denominator
                              ? `${Math.round((item.count / denominator) * 100)}%`
                              : '0%'
                            return (
                              <tr key={item.name}>
                                <td title={item.name}>{item.name}</td>
                                <td>{item.count}</td>
                                <td>{percentage}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={styles.noData}>暂无选项统计</div>
                  )
                ) : (
                  <div className={styles.textQuestionSummary}>
                    <span>有效回答</span>
                    <strong>{total} 人</strong>
                    <span className={styles.textHint}>具体内容请查看详细数据</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * Connected wrapper for the normal route usage. Supplying both `questionId`
 * and `questions` skips Redux/router access, which also makes the view easy to
 * embed in another report or test in isolation.
 */
const AllQuestionsSummary: FC<AllQuestionsSummaryProps> = props => {
  if (props.questionId !== undefined && props.questions !== undefined)
    return (
      <AllQuestionsSummaryContent
        {...props}
        questionId={props.questionId}
        questions={props.questions}
      />
    )

  return <ConnectedAllQuestionsSummary {...props} />
}

const ConnectedAllQuestionsSummary: FC<AllQuestionsSummaryProps> = props => {
  const { id = '' } = useParams()
  const { componentList } = useGetComponentInfo()

  return (
    <AllQuestionsSummaryContent
      {...props}
      questionId={props.questionId ?? id}
      questions={(props.questions ?? componentList) as SummaryQuestion[]}
    />
  )
}

export default AllQuestionsSummary
