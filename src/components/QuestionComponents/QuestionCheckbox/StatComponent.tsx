import React, { FC } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { QuestionCheckboxStatPropsType } from './interface'

const StatComponent: FC<QuestionCheckboxStatPropsType> = ({ stat }) => {
  return (
    <div style={{ width: '100%', minWidth: 0, height: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={stat}
          layout="vertical"
          margin={{
            top: 5,
            right: 12,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fontSize: 11 }}
            tickFormatter={value => (value.length > 7 ? `${value.slice(0, 7)}...` : value)}
          />
          <Tooltip />
          {/* <Legend /> */}
          <Bar dataKey="count" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default StatComponent
