/**
 * @Date        2024/02/19 17:43:15
 * @Author      zono
 * @Description 统计页
 * */
import React, { FC, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Result, Button, Segmented } from 'antd'
import { useTitle } from 'ahooks'

import useLoadQuestionData from '../../../hooks/useLoadQuestionData'
import useGetPageInfo from '../../../hooks/useGetPageInfo'
import useGetComponentInfo from '../../../hooks/useGetComponentInfo'

import StatHeader from './StatHeader'
import ComponentList from './ComponentList'
import PageStat from './PageStat'
import ChartStat from './ChartStat'
import MobileStatView from './MobileStatView'
import AllQuestionsSummary from './AllQuestionsSummary'

import styles from './index.module.scss'

const COMPACT_LAYOUT_QUERY = '(max-width: 1024px)'
type DesktopView = 'summary' | 'detail'

function getIsCompactLayout() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(COMPACT_LAYOUT_QUERY).matches
}

function useCompactLayout() {
  const [isCompactLayout, setIsCompactLayout] = useState(getIsCompactLayout)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(COMPACT_LAYOUT_QUERY)
    const onChange = (event: MediaQueryListEvent) => setIsCompactLayout(event.matches)

    setIsCompactLayout(mediaQuery.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  return isCompactLayout
}

const Stat: FC = () => {
  const nav = useNavigate()
  const [loading] = useLoadQuestionData()
  const { title, isPublished } = useGetPageInfo()
  const isCompactLayout = useCompactLayout()

  // 状态提升 selectedId type
  const [selectedComponentId, setSelectedComponentId] = useState('')
  const [selectedComponentType, setSelectedComponentType] = useState('')
  const [desktopView, setDesktopView] = useState<DesktopView>('summary')
  const { componentList } = useGetComponentInfo()

  useEffect(() => {
    if (selectedComponentId) return

    const firstChoice = componentList.find(
      component =>
        !component.isHidden && ['questionRadio', 'questionCheckbox'].includes(component.type)
    )
    if (!firstChoice) return

    setSelectedComponentId(firstChoice.fe_id)
    setSelectedComponentType(firstChoice.type)
  }, [componentList, selectedComponentId])

  // 修改标题
  useTitle(`问卷统计 - ${title}`)
  // loading 效果
  const LoadingELem = (
    <div style={{ textAlign: 'center', marginTop: '60px' }}>
      <Spin />
    </div>
  )

  // Content Elem
  function genContentElem() {
    if (typeof isPublished === 'boolean' && !isPublished)
      return (
        <div style={{ flex: '1' }}>
          <Result
            status="warning"
            title="该页面尚未发布"
            extra={
              <Button type="primary" onClick={() => nav(-1)}>
                返回
              </Button>
            }
          ></Result>
        </div>
      )

    if (typeof isPublished === 'boolean' && isPublished)
      return (
        <>
          <div className={styles.left}>
            <ComponentList
              selectedComponentId={selectedComponentId}
              setSelectedComponentId={setSelectedComponentId}
              setSelectedComponentType={setSelectedComponentType}
            />
          </div>
          <div className={styles.main}>
            <PageStat
              selectedComponentId={selectedComponentId}
              setSelectedComponentId={setSelectedComponentId}
              setSelectedComponentType={setSelectedComponentType}
            />
          </div>
          <div className={styles.right}>
            <ChartStat
              selectedComponentId={selectedComponentId}
              selectedComponentType={selectedComponentType}
            />
          </div>{' '}
        </>
      )
  }

  function genMobileContentElem() {
    if (typeof isPublished === 'boolean' && !isPublished)
      return (
        <Result
          status="warning"
          title="该页面尚未发布"
          extra={
            <Button type="primary" onClick={() => nav(-1)}>
              返回
            </Button>
          }
        />
      )

    if (typeof isPublished === 'boolean' && isPublished) return <MobileStatView />
  }

  if (isCompactLayout)
    return (
      <div className={styles.container}>
        {loading && LoadingELem}
        {!loading && genMobileContentElem()}
      </div>
    )

  return (
    <div className={styles.container}>
      <StatHeader />
      <div className={styles['content-wrapper']}>
        {loading && LoadingELem}
        {!loading && (
          <>
            <div className={styles.viewToolbar} aria-label="统计视图">
              <Segmented
                value={desktopView}
                options={[
                  { label: '全部题目', value: 'summary' },
                  { label: '单题分析', value: 'detail' },
                ]}
                onChange={value => setDesktopView(value as DesktopView)}
              />
            </div>
            {desktopView === 'summary' ? (
              <AllQuestionsSummary />
            ) : (
              <div className={styles.content}>{genContentElem()}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Stat
