#!/usr/bin/env node
/* eslint-env node */
'use strict'

/**
 * 把 mock/questionnaireFixture 里的答卷导出成成品数据文件。
 *
 * fixture 用的是确定性生成（无 Math.random），所以每次导出的结果完全一致，
 * 导出物可以直接提交进仓库，作为可复用的成品数据集。
 *
 * 产物：
 *   data/responses.json      完整答卷（含 _id、提交时间、q1..qN 原始答案）
 *   data/responses.csv       扁平化表格，Excel 可直接打开（带 BOM，UTF-8）
 *   data/questionnaire.json  题目结构，方便对照 q1..qN 分别是什么题
 *
 * 用法：node scripts/export-responses.js
 */

const fs = require('fs')
const path = require('path')

const fixture = require('../mock/questionnaireFixture')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'data')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

/** 标准 CSV 转义：含逗号/引号/换行就加引号，内部引号翻倍 */
function csvCell(value) {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function toCsv(rows, headers) {
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) {
    lines.push(headers.map(header => csvCell(row[header])).join(','))
  }
  // BOM 让 Excel 正确识别 UTF-8 中文
  return '﻿' + lines.join('\r\n') + '\r\n'
}

function main() {
  ensureDir(OUT_DIR)

  const responses = fixture.responses
  const questionKeys = fixture.questionDefinitions.map(([feId]) => feId)
  const headers = ['_id', 'submittedAt', ...questionKeys]

  // 1. 完整答卷
  const jsonPath = path.join(OUT_DIR, 'responses.json')
  fs.writeFileSync(jsonPath, JSON.stringify(responses, null, 2) + '\n')

  // 2. 扁平化 CSV
  const csvPath = path.join(OUT_DIR, 'responses.csv')
  fs.writeFileSync(csvPath, toCsv(responses, headers))

  // 3. 题目结构（q1..qN 各是什么题、有哪些选项）
  const questionPath = path.join(OUT_DIR, 'questionnaire.json')
  const questionnaire = {
    id: fixture.QUESTIONNAIRE_ID,
    responseCount: responses.length,
    sections: fixture.sections,
    questions: fixture.questionDefinitions.map(([feId, number, sectionId, type, title, options]) => ({
      feId,
      number,
      sectionId,
      type,
      title,
      options,
    })),
  }
  fs.writeFileSync(questionPath, JSON.stringify(questionnaire, null, 2) + '\n')

  for (const file of [jsonPath, csvPath, questionPath]) {
    const size = fs.statSync(file).size
    console.log(`${path.relative(ROOT, file).padEnd(28)} ${(size / 1024).toFixed(1).padStart(8)} KB`)
  }
  console.log(`\n共导出 ${responses.length} 份答卷，${questionKeys.length} 道题。`)
}

main()
