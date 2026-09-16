/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
'use strict'

/**
 * Deterministic fixture for the "大漆非遗文创产品市场调研" questionnaire.
 *
 * The shape intentionally mirrors the existing B-end API:
 *   GET /api/question/:id                 -> questionnaire
 *   GET /api/stat/:questionId             -> { total, list }
 *   GET /api/stat/:questionId/:componentId -> { stat }
 *   GET /api/stat/:questionId/summary     -> { total, stats }
 *
 * Keep this module dependency-free so the standalone mock server can require it
 * from a checkout of this repository. Responses are generated once from a
 * fixed sequence; no Math.random/Mock.Random is used.
 */

const QUESTIONNAIRE_ID = 'daqi-heritage-market-2026'
// Keep the demo at the requested scale while generating rows deterministically.
// The API still returns only the requested page, so the browser never receives
// all 1,533 responses at once.
const RESPONSE_COUNT = 1533
const source = require('./questionnaireSource.json')

const sections = source.sections.map(section => ({
  id: section.id,
  title: section.title,
  rawTitle: section.rawTitle,
  range: section.questionRange,
}))

// The source document uses A/B/C... labels. The editor stores option values
// separately, while answer rows store the visible text (as the original mock).
const questionDefinitions = source.questions.map(question => [
  question.id,
  question.number,
  question.sectionId,
  question.type === 'multiple' ? 'multiple' : question.type === 'text' ? 'textarea' : 'single',
  question.title,
  question.options.map(option => option.text),
])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function makeOptions(texts, checked) {
  return texts.map((text, index) => ({
    value: String.fromCharCode(65 + index),
    text,
    ...(checked ? { checked: false } : {}),
  }))
}

function makeQuestionComponent(definition) {
  const [feId, number, sectionId, kind, title, optionTexts] = definition

  if (kind === 'textarea') {
    return {
      fe_id: feId,
      type: 'questionTextarea',
      title: `第${number}题（开放题）`,
      isHidden: false,
      isLocked: false,
      props: {
        title,
        placeholder: '请简要填写您的建议',
      },
      questionNumber: number,
      sectionId,
    }
  }

  const isMultiple = kind === 'multiple'
  return {
    fe_id: feId,
    type: isMultiple ? 'questionCheckbox' : 'questionRadio',
    title: `第${number}题（${isMultiple ? '多选' : '单选'}）`,
    isHidden: false,
    isLocked: false,
    props: isMultiple
      ? {
          title,
          isVertical: true,
          list: makeOptions(optionTexts, true),
        }
      : {
          title,
          isVertical: true,
          options: makeOptions(optionTexts),
          value: '',
        },
    questionNumber: number,
    sectionId,
  }
}

const components = [
  {
    fe_id: 'intro-greeting',
    type: 'questionParagraph',
    title: '开场白',
    isHidden: false,
    isLocked: false,
    props: {
      text: source.intro[0],
      isCenter: false,
    },
  },
  {
    fe_id: 'intro',
    type: 'questionInfo',
    title: '问卷说明',
    isHidden: false,
    isLocked: false,
    props: {
      title: source.title,
      desc: source.intro.slice(1).join('\n'),
    },
  },
  {
    fe_id: 'survey-title',
    type: 'questionTitle',
    title: '问卷标题',
    isHidden: false,
    isLocked: false,
    props: {
      text: source.title,
      level: 2,
      isCenter: true,
    },
  },
]

sections.forEach(section => {
  components.push({
    fe_id: section.id,
    type: 'questionParagraph',
    title: section.title,
    isHidden: false,
    isLocked: false,
    props: {
      text: section.rawTitle,
      isCenter: false,
    },
  })
  questionDefinitions
    .filter(definition => definition[2] === section.id)
    .forEach(definition => components.push(makeQuestionComponent(definition)))
})

components.push({
  fe_id: 'ending',
  type: 'questionParagraph',
  title: '结束语',
  isHidden: false,
  isLocked: false,
  props: {
    text: source.ending,
    isCenter: true,
  },
})

const questionnaire = {
  id: QUESTIONNAIRE_ID,
  title: source.title,
  desc: source.intro.slice(1).join('\n'),
  js: '',
  css: '',
  isDeleted: false,
  isPublished: true,
  componentList: components,
}

// A small weighted sequence keeps the demo distributions believable while
// remaining reproducible. It deliberately avoids a random source.
function weightedIndex(seed, optionCount) {
  const weights = [42, 28, 18, 8, 4, 2]
  const selected = weights.slice(0, optionCount)
  const total = selected.reduce((sum, item) => sum + item, 0)
  let cursor = (seed * 37 + 11) % total
  for (let index = 0; index < selected.length; index += 1) {
    cursor -= selected[index]
    if (cursor < 0) return index
  }
  return selected.length - 1
}

function buildResponse(index) {
  const row = {
    _id: `daqi-answer-${String(index + 1).padStart(3, '0')}`,
    submittedAt: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T${String(
      9 + (index % 10)
    ).padStart(2, '0')}:${String((index * 13) % 60).padStart(2, '0')}:00+08:00`,
  }

  questionDefinitions.forEach(([feId, number, , kind, , optionTexts]) => {
    if (kind === 'textarea') {
      const suggestions = [
        '希望兼顾传统工艺和日常实用性，价格可以分档。',
        '建议多做短视频展示制作过程，并在线下市集提供体验。',
        '包装可以更精致，同时附上简明的非遗文化说明卡。',
        '希望增加年轻化配色和小件礼盒，方便送礼和收藏。',
      ]
      row[feId] = suggestions[index % suggestions.length]
      return
    }

    const firstIndex = weightedIndex(index + number, optionTexts.length)
    if (kind === 'multiple') {
      const selected = [optionTexts[firstIndex]]
      // Roughly two thirds of multi-select answers contain a second choice.
      if ((index + number) % 3 !== 0 && optionTexts.length > 1) {
        const secondIndex =
          (firstIndex + 1 + ((index + number) % (optionTexts.length - 1))) % optionTexts.length
        if (secondIndex !== firstIndex) selected.push(optionTexts[secondIndex])
      }
      row[feId] = selected.join(',')
      return
    }

    row[feId] = optionTexts[firstIndex]
  })

  return row
}

const responses = Array.from({ length: RESPONSE_COUNT }, (_, index) => buildResponse(index))

function getQuestionnaire(id = QUESTIONNAIRE_ID) {
  if (id !== QUESTIONNAIRE_ID) return null
  return clone(questionnaire)
}

function getResponsePage({ page = 1, pageSize = 10 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 100)
  const start = (safePage - 1) * safePageSize
  return {
    total: responses.length,
    list: clone(responses.slice(start, start + safePageSize)),
  }
}

function getComponentStat(componentId) {
  const component = components.find(item => item.fe_id === componentId)
  if (!component || !['questionRadio', 'questionCheckbox'].includes(component.type)) return []

  const options =
    component.type === 'questionCheckbox' ? component.props.list : component.props.options
  const counts = new Map(options.map(option => [option.text, 0]))

  responses.forEach(response => {
    const value = response[componentId]
    if (component.type === 'questionCheckbox') {
      String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
        .forEach(item => counts.set(item, (counts.get(item) || 0) + 1))
    } else if (value != null && value !== '') {
      counts.set(String(value), (counts.get(String(value)) || 0) + 1)
    }
  })

  return options.map(option => ({ name: option.text, count: counts.get(option.text) || 0 }))
}

// Build all option counts in one pass over the response set. The individual
// endpoint above remains available for the existing chart view, while the
// summary endpoint avoids one network request per question on the overview.
function getComponentStatSummary() {
  const answerComponents = components.filter(item =>
    ['questionRadio', 'questionCheckbox', 'questionInput', 'questionTextarea'].includes(item.type)
  )
  const countMaps = new Map()

  answerComponents.forEach(component => {
    const options =
      component.type === 'questionCheckbox' ? component.props.list : component.props.options
    countMaps.set(
      component.fe_id,
      new Map((options || []).map(option => [option.text, 0]))
    )
  })

  responses.forEach(response => {
    answerComponents.forEach(component => {
      const counts = countMaps.get(component.fe_id)
      if (!counts || counts.size === 0) return

      const value = response[component.fe_id]
      if (component.type === 'questionCheckbox') {
        String(value || '')
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
          .forEach(item => counts.set(item, (counts.get(item) || 0) + 1))
      } else if (value != null && value !== '') {
        counts.set(String(value), (counts.get(String(value)) || 0) + 1)
      }
    })
  })

  const stats = {}
  answerComponents.forEach(component => {
    const options =
      component.type === 'questionCheckbox' ? component.props.list : component.props.options
    const counts = countMaps.get(component.fe_id)
    stats[component.fe_id] = (options || []).map(option => ({
      name: option.text,
      count: counts ? counts.get(option.text) || 0 : 0,
    }))
  })

  return {
    total: responses.length,
    stats,
  }
}

function getQuestionSummary() {
  return {
    _id: QUESTIONNAIRE_ID,
    id: QUESTIONNAIRE_ID,
    title: questionnaire.title,
    isDeleted: false,
    isPublished: true,
    isStar: false,
    answerCount: responses.length,
    createdAt: '2026-08-01T09:00:00+08:00',
    updatedAt: '2026-08-18T09:00:00+08:00',
  }
}

function matchesBooleanFilter(value, actual) {
  if (value == null || value === '') return true
  return String(value) === String(actual)
}

function getQuestionList({ keyword = '', isStar, isDeleted, page = 1, pageSize = 10 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 100)
  const start = (safePage - 1) * safePageSize
  const summary = getQuestionSummary()
  const normalizedKeyword = String(keyword || '').trim().toLocaleLowerCase()
  const matchesKeyword =
    !normalizedKeyword || summary.title.toLocaleLowerCase().includes(normalizedKeyword)
  const matchesFilters =
    matchesBooleanFilter(isStar, summary.isStar) &&
    matchesBooleanFilter(isDeleted, summary.isDeleted)
  const matches = matchesKeyword && matchesFilters ? [summary] : []

  return {
    total: matches.length,
    List: clone(matches.slice(start, start + safePageSize)),
  }
}

module.exports = {
  QUESTIONNAIRE_ID,
  RESPONSE_COUNT,
  sections,
  questionDefinitions,
  components,
  responses,
  getQuestionnaire,
  getResponsePage,
  getComponentStat,
  getComponentStatSummary,
  getQuestionSummary,
  getQuestionList,
}
