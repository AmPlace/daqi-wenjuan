import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import {
  getComponentStatService,
  getQuestionStatListService,
  getQuestionStatSummaryService,
} from '../../../services/stat'
import MobileStatView from './MobileStatView'

jest.mock('../../../hooks/useGetPageInfo', () => ({
  __esModule: true,
  default: () => ({ title: '测试问卷', isPublished: true }),
}))

jest.mock('../../../hooks/useGetComponentInfo', () => ({
  __esModule: true,
  default: () => ({
    componentList: [
      {
        fe_id: 'c7',
        type: 'questionRadio',
        title: '单选',
        questionNumber: 1,
        props: {
          title: '单选标题',
          options: [
            { value: 'item1', text: '选项1' },
            { value: 'item2', text: '选项2' },
          ],
        },
      },
      {
        fe_id: 'c8',
        type: 'questionCheckbox',
        title: '多选',
        questionNumber: 7,
        props: {
          title: '多选标题',
          list: [
            { value: 'item1', text: '选项1' },
            { value: 'item2', text: '选项2' },
          ],
        },
      },
      {
        fe_id: 'c40',
        type: 'questionTextarea',
        title: '开放题',
        questionNumber: 40,
        props: {
          title: '开放题标题',
          placeholder: '请填写建议',
        },
      },
    ],
  }),
}))

jest.mock('../../../services/stat', () => ({
  getComponentStatService: jest.fn(),
  getQuestionStatListService: jest.fn(),
  getQuestionStatSummaryService: jest.fn(),
}))

jest.mock('recharts', () => {
  const reactModule = jest.requireActual<typeof import('react')>('react')
  const ChartWrapper = ({ children }: { children?: import('react').ReactNode }) =>
    reactModule.createElement('div', null, children)
  const ChartElement = () => null

  return {
    Bar: ChartElement,
    BarChart: ChartWrapper,
    CartesianGrid: ChartElement,
    Cell: ChartElement,
    Line: ChartElement,
    LineChart: ChartWrapper,
    Pie: ChartWrapper,
    PieChart: ChartWrapper,
    ResponsiveContainer: ChartWrapper,
    Tooltip: ChartElement,
    XAxis: ChartElement,
    YAxis: ChartElement,
  }
})

const getComponentStatMock = getComponentStatService as jest.MockedFunction<
  typeof getComponentStatService
>
const getQuestionStatListMock = getQuestionStatListService as jest.MockedFunction<
  typeof getQuestionStatListService
>
const getQuestionStatSummaryMock = getQuestionStatSummaryService as jest.MockedFunction<
  typeof getQuestionStatSummaryService
>

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
})

async function renderPage() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/question/stat/question-1']}>
        <Routes>
          <Route path="/question/stat/:id" element={<MobileStatView />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

beforeEach(() => {
  getComponentStatMock.mockImplementation(async (_questionId, componentId) => ({
    stat:
      componentId === 'c8'
        ? [
            { name: '选项1', count: 1 },
            { name: '选项2', count: 1 },
          ]
        : [
            { name: '选项1', count: 3 },
            { name: '选项2', count: 1 },
          ],
  }))
  getQuestionStatListMock.mockResolvedValue({
    total: 2,
    list: [
      { _id: 'answer-1', c7: '选项1', c8: '选项1,选项2', c40: '第一条建议' },
      { _id: 'answer-2', c7: '选项2', c8: '选项2', c40: '第二条建议' },
    ],
  })
  getQuestionStatSummaryMock.mockResolvedValue({
    total: 1533,
    stats: {
      c7: [
        { name: '选项1', count: 900 },
        { name: '选项2', count: 633 },
      ],
      c8: [
        { name: '选项1', count: 800 },
        { name: '选项2', count: 733 },
      ],
      c40: [],
    },
  })
})

test('总览显示全部题目和选项人数', async () => {
  await renderPage()

  expect(await screen.findByRole('heading', { name: '全部题目统计' })).toBeInTheDocument()
  const summary = screen.getByRole('region', { name: '全部题目统计' })
  expect(summary).toHaveTextContent('1533 份答卷')
  expect(await within(summary).findByRole('row', { name: '选项1 900 59%' })).toBeInTheDocument()
  expect(within(summary).getByRole('row', { name: '选项2 633 41%' })).toBeInTheDocument()
  expect(getQuestionStatSummaryMock).toHaveBeenCalledWith('question-1')
})

test('展示统计结果并切换图表类型', async () => {
  await renderPage()
  fireEvent.click(screen.getByRole('button', { name: '单题统计' }))

  expect(screen.getByRole('heading', { name: '统计结果' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: '测试问卷' })).toBeInTheDocument()

  await waitFor(() => expect(getComponentStatMock).toHaveBeenCalledWith('question-1', 'c7'))

  expect(await screen.findByRole('row', { name: '选项1 3 75%' })).toBeInTheDocument()
  expect(screen.getByRole('row', { name: '本题有效填写人次 4 100%' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '圆环图' }))
  expect(screen.getByRole('button', { name: '圆环图' })).toHaveAttribute('aria-pressed', 'true')
})

test('切换题目并查看详细数据', async () => {
  await renderPage()
  fireEvent.click(screen.getByRole('button', { name: '单题统计' }))

  await waitFor(() => expect(getComponentStatMock).toHaveBeenCalledWith('question-1', 'c7'))
  expect(await screen.findByRole('row', { name: '选项1 3 75%' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '切换题目' }))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /第7题 多选标题/ }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  await waitFor(() => expect(getComponentStatMock).toHaveBeenCalledWith('question-1', 'c8'))
  expect(screen.getByText('多选标题')).toBeInTheDocument()
  expect(screen.getByText('[多选题]')).toBeInTheDocument()
  expect(await screen.findByRole('row', { name: '选项1 1 50%' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '详细数据' }))

  expect(await screen.findByText('共 2 份')).toBeInTheDocument()
  expect(screen.getByRole('row', { name: '1 选项1,选项2' })).toBeInTheDocument()
})

test('开放题可从题目选择器进入详细答卷', async () => {
  await renderPage()
  fireEvent.click(screen.getByRole('button', { name: '单题统计' }))

  await waitFor(() => expect(getComponentStatMock).toHaveBeenCalledWith('question-1', 'c7'))
  fireEvent.click(screen.getByRole('button', { name: '切换题目' }))
  fireEvent.click(screen.getByRole('button', { name: /第40题 开放题标题/ }))

  expect(screen.getByRole('button', { name: '详细数据' })).toHaveAttribute('aria-current', 'page')
  expect(await screen.findByRole('heading', { name: '开放题标题' })).toBeInTheDocument()
  expect(screen.getByRole('row', { name: '1 第一条建议' })).toBeInTheDocument()
  expect(getComponentStatMock).not.toHaveBeenCalledWith('question-1', 'c40')
})

test('详细答卷可分页查看全部数据', async () => {
  getQuestionStatListMock.mockImplementation(async (_questionId, { page }) => ({
    total: 12,
    list:
      page === 2
        ? [
            { _id: 'answer-11', c7: '第11份答案' },
            { _id: 'answer-12', c7: '第12份答案' },
          ]
        : Array.from({ length: 10 }, (_, index) => ({
            _id: `answer-${index + 1}`,
            c7: `第${index + 1}份答案`,
          })),
  }))

  await renderPage()
  fireEvent.click(screen.getByRole('button', { name: '单题统计' }))
  fireEvent.click(screen.getByRole('button', { name: '详细数据' }))

  expect(await screen.findByRole('row', { name: '10 第10份答案' })).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(screen.getByTitle('2'))
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  await waitFor(() =>
    expect(getQuestionStatListMock).toHaveBeenCalledWith('question-1', {
      page: 2,
      pageSize: 10,
    })
  )
  expect(await screen.findByRole('row', { name: '11 第11份答案' })).toBeInTheDocument()
})
