import React, { FC, useState } from 'react'
import { Typography, Spin, Table, Pagination } from 'antd'
import { useRequest } from 'ahooks'
import { useParams } from 'react-router-dom'
import { getQuestionStatListService } from '../../../services/stat'
import useGetComponentInfo from '../../../hooks/useGetComponentInfo'
import { STAT_PAGE_SIZE } from '../../../constant'

const { Title } = Typography

type PropsType = {
  selectedComponentId: string
  setSelectedComponentId: (id: string) => void
  setSelectedComponentType: (type: string) => void
}

const PageStat: FC<PropsType> = (props: PropsType) => {
  const { selectedComponentId, setSelectedComponentId, setSelectedComponentType } = props

  const { id = '' } = useParams()

  const [page, setPage] = useState(1) //分页
  const [pageSize, setPageSize] = useState(STAT_PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [list, setList] = useState([])

  //请求数据
  const { loading } = useRequest(
    async () => {
      const res = await getQuestionStatListService(id, { page, pageSize })
      return res
    },
    {
      refreshDeps: [id, page, pageSize], //依赖改变时重新请求
      onSuccess(res) {
        const { total, list = [] } = res
        setTotal(total)
        setList(list)
      },
    }
  )

  // 说明、标题和分组组件没有答卷值，不应该占用答卷表的列。
  const { componentList } = useGetComponentInfo() //获取组件列表
  const answerComponents = componentList.filter(c =>
    ['questionInput', 'questionTextarea', 'questionRadio', 'questionCheckbox'].includes(c.type)
  )
  const columns = answerComponents.map(c => {
    const { fe_id, title, props: componentProps = {}, type } = c

    const colTitle = componentProps.title || title

    return {
      //  点击选中效果
      title: (
        <div
          style={{ cursor: 'pointer' }}
          onClick={() => {
            setSelectedComponentId(fe_id)
            setSelectedComponentType(type)
          }}
        >
          <span style={{ color: fe_id === selectedComponentId ? '#1890ff' : 'inherit' }}>
            {colTitle}
          </span>
        </div>
      ),
      dataIndex: fe_id,
      width: 220,
    }
  })

  // 每个item添加key
  const dataSource = list.map((i: any) => ({ ...i, key: i._id }))
  const TableElem = (
    <>
      {/* 传入表头，关闭默认分页 */}
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        scroll={{ x: Math.max(columns.length * 220, 800) }}
        tableLayout="fixed"
      ></Table>
      <div style={{ textAlign: 'center', marginTop: '18px' }}>
        <Pagination
          total={total} //总条数
          pageSize={pageSize} //每页条数
          current={page} //当前页
          onChange={page => setPage(page)}
          onShowSizeChange={(page, pageSize) => {
            setPage(page)
            setPageSize(pageSize)
          }}
        />
      </div>
    </>
  )

  return (
    <div>
      <Title level={3}>答卷数量: {!loading && total}</Title>
      {loading && (
        <div style={{ textAlign: 'center' }}>
          <Spin />
        </div>
      )}
      {!loading && TableElem}
    </div>
  )
}

export default PageStat
