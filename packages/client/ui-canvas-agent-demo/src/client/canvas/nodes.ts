/** Static demo content for the canvas. Replace with your real document model. */
export interface DemoNode {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly question: string
}

export const DEMO_NODES: readonly DemoNode[] = [
  {
    id: 'brief',
    title: '需求摘要',
    body: '为现有编辑器增加“选中即问”的 AI 入口，回答需要引用当前节点内容。',
    question: '这段需求里有哪些隐含的交互约束？',
  },
  {
    id: 'architecture',
    title: '架构草图',
    body: '画布是主视图，会话能力以嵌入式岛的形式挂在节点上，Agent 运行时保持独立。',
    question: '这个架构最大的升级风险点在哪里？',
  },
  {
    id: 'risks',
    title: '风险清单',
    body: '同一会话只允许一个可写输入区；浮层需要处理会话代际切换后的引用失效。',
    question: '帮我把这些风险按影响面排序。',
  },
]
