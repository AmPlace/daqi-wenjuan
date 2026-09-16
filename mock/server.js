/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
'use strict'

/**
 * Small dependency-free mock server for local development.
 *
 * It intentionally implements the response envelopes consumed by the React
 * app. The questionnaire and all statistics come from questionnaireFixture,
 * so restarting the server never changes the demo data.
 */

const http = require('http')
const { URL } = require('url')
const fixture = require('./questionnaireFixture')

const DEFAULT_PORT = 3001
const DEMO_USER = {
  username: 'demo_user',
  nickname: '演示用户',
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > 1024 * 1024) {
        reject(new Error('request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function questionnaireForId(id) {
  const data = fixture.getQuestionnaire(fixture.QUESTIONNAIRE_ID)
  // The fixture has one canonical ID, but accepting an arbitrary route ID
  // keeps direct links copied from an earlier mock session usable.
  if (id) data.id = id
  return data
}

function getPathParts(pathname) {
  return pathname
    .split('/')
    .filter(Boolean)
    .map(part => decodeURIComponent(part))
}

async function handleRequest(req, res) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const requestUrl = new URL(req.url || '/', 'http://localhost')
  const parts = getPathParts(requestUrl.pathname)
  if (['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    try {
      await readJsonBody(req)
    } catch (error) {
      sendJson(res, 400, { errno: 400, msg: error.message })
      return
    }
  }

  // User endpoints are deliberately permissive: this server is for local UI
  // work and does not pretend to authenticate or persist accounts.
  if (req.method === 'GET' && parts.join('/') === 'api/user/info') {
    sendJson(res, 200, { errno: 0, data: clone(DEMO_USER) })
    return
  }
  if (req.method === 'POST' && parts.join('/') === 'api/user/login') {
    sendJson(res, 200, { errno: 0, data: { token: 'mock-token' } })
    return
  }
  if (req.method === 'POST' && parts.join('/') === 'api/user/register') {
    sendJson(res, 200, { errno: 0 })
    return
  }

  // Question list/detail endpoints.
  if (parts[0] === 'api' && parts[1] === 'question') {
    if (req.method === 'GET' && parts.length === 3) {
      sendJson(res, 200, { errno: 0, data: questionnaireForId(parts[2]) })
      return
    }
    if (req.method === 'GET' && parts.length === 2) {
      sendJson(res, 200, {
        errno: 0,
        data: fixture.getQuestionList({
          keyword: requestUrl.searchParams.get('keyword'),
          isStar: requestUrl.searchParams.get('isStar'),
          isDeleted: requestUrl.searchParams.get('isDeleted'),
          page: requestUrl.searchParams.get('page'),
          pageSize: requestUrl.searchParams.get('pageSize'),
        }),
      })
      return
    }
    if (req.method === 'POST' && parts.length === 2) {
      sendJson(res, 200, {
        errno: 0,
        data: { id: fixture.QUESTIONNAIRE_ID, _id: fixture.QUESTIONNAIRE_ID },
      })
      return
    }
    if (req.method === 'POST' && parts[2] === 'duplicate' && parts.length === 4) {
      sendJson(res, 200, {
        errno: 0,
        data: { id: fixture.QUESTIONNAIRE_ID, _id: fixture.QUESTIONNAIRE_ID },
      })
      return
    }
    if (req.method === 'PATCH' && parts.length === 3) {
      sendJson(res, 200, { errno: 0 })
      return
    }
    if (req.method === 'DELETE' && parts.length === 2) {
      sendJson(res, 200, { errno: 0 })
      return
    }
  }

  // The summary route serves all question option counts in one response. It
  // must be checked before the generic component-stat route.
  if (
    parts[0] === 'api' &&
    parts[1] === 'stat' &&
    parts.length === 4 &&
    parts[3] === 'summary' &&
    req.method === 'GET'
  ) {
    sendJson(res, 200, {
      errno: 0,
      data: fixture.getComponentStatSummary(),
    })
    return
  }
  // Component-stat route must be checked before the one-segment stat route.
  if (parts[0] === 'api' && parts[1] === 'stat' && parts.length === 4 && req.method === 'GET') {
    sendJson(res, 200, {
      errno: 0,
      data: { stat: fixture.getComponentStat(parts[3]) },
    })
    return
  }
  if (parts[0] === 'api' && parts[1] === 'stat' && parts.length === 3 && req.method === 'GET') {
    sendJson(res, 200, {
      errno: 0,
      data: fixture.getResponsePage({
        page: requestUrl.searchParams.get('page'),
        pageSize: requestUrl.searchParams.get('pageSize'),
      }),
    })
    return
  }

  sendJson(res, 404, { errno: 404, msg: '接口不存在' })
}

function createMockServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch(error => {
      if (!res.headersSent) sendJson(res, 500, { errno: 500, msg: error.message })
      else res.end()
    })
  })
}

if (require.main === module) {
  const port = Number(process.env.PORT || DEFAULT_PORT)
  createMockServer().listen(port, () => {
    console.log(`questionnaire mock listening on http://localhost:${port}`)
    console.log(`fixture: ${fixture.QUESTIONNAIRE_ID}, responses: ${fixture.RESPONSE_COUNT}`)
  })
}

module.exports = {
  createMockServer,
  handleRequest,
}
