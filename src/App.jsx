import React, { useState, useEffect, useMemo } from "react";
import { 
  Layout, Menu, Button, Input, Select, Card, Tag, 
  Space, Modal, Form, Table, Timeline, message, 
  Popconfirm, Typography, Divider, Row, Col, List, Radio, Badge, ConfigProvider, Empty, Tooltip, Progress
} from "antd";
import { 
  InboxOutlined, 
  BookOutlined,
  SolutionOutlined,
  HistoryOutlined, 
  KeyOutlined, 
  DeleteOutlined, 
  PlusOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  FileExcelOutlined,
  CoffeeOutlined,
  DesktopOutlined,
  EditOutlined,
  SearchOutlined,
  ProjectOutlined,
  AlertOutlined
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const App = () => {
  const [currentView, setCurrentView] = useState("inbox");
  const [allTasks, setAllTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [searchText, setSearchText] = useState("");
  
  // Inbox State
  const [inboxTitle, setInboxTitle] = useState("");
  const [inboxContent, setInboxContent] = useState("");
  const [inboxCategory, setInboxCategory] = useState("personal");
  const [inboxType, setInboxType] = useState("memo");
  const [inboxProject, setInboxProject] = useState(null);

  // Edit State
  const [editingTask, setEditingTask] = useState(null);
  const [editForm] = Form.useForm();

  // Project Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectForm] = Form.useForm();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountForm] = Form.useForm();

  useEffect(() => {
    refreshAll();
  }, []);

  const refreshAll = async () => {
    await Promise.all([refreshData(), refreshProjects()]);
  };

  const refreshData = async () => {
    try {
      const tasks = await invoke("get_tasks", { 
        categoryFilter: null, 
        statusFilter: null,
        typeFilter: null,
        projectFilter: null
      });
      setAllTasks(tasks);
    } catch (err) {
      message.error("获取数据失败: " + err);
    }
  };

  const refreshProjects = async () => {
    try {
      const data = await invoke("get_projects");
      setAllProjects(data);
    } catch (err) {
      message.error("获取项目失败: " + err);
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await invoke("get_accounts");
      setAccounts(data);
    } catch (err) {
      message.error("获取账号失败: " + err);
    }
  };

  useEffect(() => {
    if (currentView === "accounts") {
      loadAccounts();
    }
  }, [currentView]);

  // --- Handlers ---
  const handleAddTask = async () => {
    if (!inboxTitle.trim()) return;
    try {
      await invoke("add_task", {
        title: inboxTitle,
        content: inboxContent || null,
        category: inboxCategory,
        taskType: inboxType,
        status: inboxType === "knowledge" ? "fixed" : "inbox",
        priority: "medium",
        projectName: inboxProject || null,
      });
      setInboxTitle("");
      setInboxContent("");
      message.success("记录成功");
      refreshData();
    } catch (err) {
      message.error("保存失败: " + err);
    }
  };

  const handleDeleteTask = async (id) => {
    try {
      await invoke("delete_task", { id });
      message.success("已删除");
      refreshData();
    } catch (err) {
      message.error("删除失败: " + err);
    }
  };

  const handleChangeStatus = async (id, status) => {
    try {
      await invoke("update_task_status", { id, status });
      refreshData();
    } catch (err) {
      message.error("更新失败: " + err);
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    editForm.setFieldsValue({
      ...task,
      taskType: task.task_type,
      projectName: task.project_name || undefined
    });
  };

  const handleUpdateTask = async (values) => {
    try {
      await invoke("update_task", {
        id: editingTask.id,
        title: values.title,
        content: values.content || null,
        category: values.category,
        taskType: values.taskType,
        status: values.status,
        priority: editingTask.priority || "medium",
        projectName: values.projectName || null
      });
      message.success("更新成功");
      setEditingTask(null);
      refreshData();
    } catch (err) {
      message.error("更新失败: " + err);
    }
  };

  const handleAddProject = async (values) => {
    try {
      await invoke("add_project", { ...values });
      message.success("项目创建成功");
      setIsProjectModalOpen(false);
      projectForm.resetFields();
      refreshProjects();
    } catch (err) {
      message.error("创建失败: " + err);
    }
  };

  const handleDeleteProject = async (id) => {
    try {
      await invoke("delete_project", { id });
      message.success("项目已删除");
      refreshProjects();
    } catch (err) {
      message.error("删除失败: " + err);
    }
  };

  const handleExport = async (filters = {}) => {
    try {
      const filePath = await save({
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        defaultPath: 'tasks_export.xlsx'
      });
      if (filePath) {
        await invoke("export_tasks_to_excel", { 
          path: filePath,
          category: filters.category || null,
          status: filters.status || null,
          taskType: filters.taskType || null,
          projectName: filters.projectName || null
        });
        message.success("导出成功: " + filePath);
      }
    } catch (err) {
      message.error("导出失败: " + err);
    }
  };

  const handleExportAccounts = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        defaultPath: 'accounts_export.xlsx'
      });
      if (filePath) {
        await invoke("export_accounts_to_excel", { path: filePath });
        message.success("导出成功: " + filePath);
      }
    } catch (err) {
      message.error("导出失败: " + err);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} 已复制`);
  };

  // --- Data Helpers ---
  const filteredTasks = useMemo(() => {
    if (!searchText) return allTasks;
    const lowerSearch = searchText.toLowerCase();
    return allTasks.filter(t => 
      t.title.toLowerCase().includes(lowerSearch) || 
      (t.content && t.content.toLowerCase().includes(lowerSearch)) ||
      (t.project_name && t.project_name.toLowerCase().includes(lowerSearch))
    );
  }, [allTasks, searchText]);

  const workTasks = filteredTasks.filter(t => t.category === 'work');
  const personalTasks = filteredTasks.filter(t => t.category === 'personal');

  // --- Views ---

  const renderInbox = () => (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2}>下午好, 开发者</Title>
          <Text type="secondary">捕捉今天的灵感或记录工作任务</Text>
        </div>
        <Space>
          <Input 
            prefix={<SearchOutlined />} 
            placeholder="搜索所有记录..." 
            style={{ width: 300, borderRadius: 20 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button ghost icon={<FileExcelOutlined />} onClick={() => handleExport({ status: 'inbox' })}>导出收集箱</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 40, border: '1px solid #e2e8f0' }} bodyStyle={{ padding: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Input 
            size="large"
            variant="borderless"
            placeholder="在这里输入标题..." 
            value={inboxTitle}
            onChange={(e) => setInboxTitle(e.target.value)}
            style={{ fontSize: 20, fontWeight: 500, padding: 0 }}
          />
          <TextArea
            rows={3}
            variant="borderless"
            placeholder="添加详细说明、路径或备注..."
            value={inboxContent}
            onChange={(e) => setInboxContent(e.target.value)}
            style={{ padding: 0, fontSize: 15 }}
          />
          <Divider style={{ margin: '8px 0' }} />
          <Row gutter={16} align="middle">
            <Col span={18}>
              <Space wrap size="middle">
                <Radio.Group value={inboxCategory} onChange={(e) => setInboxCategory(e.target.value)} buttonStyle="solid">
                  <Radio.Button value="personal"><CoffeeOutlined /> 个人</Radio.Button>
                  <Radio.Button value="work"><DesktopOutlined /> 工作</Radio.Button>
                </Radio.Group>
                <Radio.Group value={inboxType} onChange={(e) => setInboxType(e.target.value)}>
                  <Radio.Button value="memo">便笺</Radio.Button>
                  <Radio.Button value="task">任务</Radio.Button>
                  <Radio.Button value="knowledge">知识</Radio.Button>
                </Radio.Group>
                <Select
                  placeholder="关联项目"
                  style={{ width: 140 }}
                  allowClear
                  value={inboxProject}
                  onChange={setInboxProject}
                >
                  {allProjects.map((p) => (
                    <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>
                  ))}
                </Select>
              </Space>
            </Col>
            <Col span={6} style={{ textAlign: 'right' }}>
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAddTask} shape="rounded">
                立即记录
              </Button>
            </Col>
          </Row>
        </Space>
      </Card>

      <Row gutter={32}>
        <Col span={12}>
          <Title level={4} style={{ marginBottom: 20 }}>待整理便笺 ({personalTasks.filter(t => t.status === 'inbox').length})</Title>
          <List
            locale={{ emptyText: <Empty description="暂无待整理便笺" /> }}
            dataSource={personalTasks.filter(t => t.status === 'inbox')}
            renderItem={t => (
              <Card size="small" style={{ marginBottom: 12, borderLeft: '4px solid #f97316' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Text strong>{t.title}</Text>
                    {t.content && <Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ marginBottom: 0, fontSize: 13 }}>{t.content}</Paragraph>}
                  </div>
                  <Space>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditTask(t)} />
                    <Button type="text" size="small" icon={<CheckCircleOutlined />} onClick={() => handleChangeStatus(t.id, 'todo')} />
                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTask(t.id)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            )}
          />
        </Col>
        <Col span={12}>
          <Title level={4} style={{ marginBottom: 20 }}>待整理任务 ({workTasks.filter(t => t.status === 'inbox').length})</Title>
          <List
            locale={{ emptyText: <Empty description="暂无待整理任务" /> }}
            dataSource={workTasks.filter(t => t.status === 'inbox')}
            renderItem={t => (
              <Card size="small" style={{ marginBottom: 12, borderLeft: '4px solid #3b82f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Text strong>{t.title}</Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag color="blue" bordered={false}>{t.project_name || '通用'}</Tag>
                    </div>
                  </div>
                  <Space>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditTask(t)} />
                    <Button type="text" size="small" icon={<SyncOutlined />} onClick={() => handleChangeStatus(t.id, 'todo')} />
                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTask(t.id)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            )}
          />
        </Col>
      </Row>
    </div>
  );

  const renderProjectCenter = () => {
    return (
      <div style={{ padding: '40px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>🏢 工作项目中心</Title>
            <Text type="secondary">管理并跟踪您的所有业务项目进度</Text>
          </div>
          <Space>
            <Input 
              prefix={<SearchOutlined />} 
              placeholder="搜索项目或任务..." 
              style={{ width: 250 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsProjectModalOpen(true)}>新建项目</Button>
            <Button ghost icon={<FileExcelOutlined />} onClick={() => handleExport({ category: 'work' })}>导出报表</Button>
          </Space>
        </div>
        
        {allProjects.length === 0 && <Empty description="点击“新建项目”开始管理工作" />}

        <Row gutter={[24, 24]}>
          {allProjects.map(proj => {
            const projectTasks = workTasks.filter(t => t.project_name === proj.name);
            const activeTasks = projectTasks.filter(t => t.status !== 'inbox');
            const pendingTasks = projectTasks.filter(t => t.status === 'inbox');
            
            const doneCount = activeTasks.filter(t => t.status === 'done').length;
            const progress = activeTasks.length > 0 ? Math.round((doneCount / activeTasks.length) * 100) : 0;
            
            return (
              <Col span={24} key={proj.id}>
                <Card 
                  style={{ borderRadius: 16 }}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <Space size="middle" wrap>
                        <div style={{ width: 40, height: 40, background: '#eff6ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <SolutionOutlined style={{ color: '#3b82f6', fontSize: 20 }} />
                        </div>
                        <div style={{ maxWidth: '300px' }}>
                          <Text strong style={{ fontSize: 18, display: 'block' }}>{proj.name}</Text>
                          <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b', whiteSpace: 'normal', lineHeight: '1.4' }}>{proj.description || '无项目描述'}</div>
                        </div>
                        <Tag color={proj.status === 'active' ? 'processing' : 'default'}>{proj.status === 'active' ? '进行中' : '已归档'}</Tag>
                      </Space>
                      <div style={{ width: 350, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>完成进度</Text>
                            <Text strong style={{ fontSize: 12 }}>{progress}%</Text>
                          </div>
                          <Progress percent={progress} size="small" showInfo={false} strokeColor={progress === 100 ? '#22c55e' : '#3b82f6'} />
                        </div>
                        <Space>
                          <Button size="small" icon={<FileExcelOutlined />} onClick={() => handleExport({ projectName: proj.name })}>导出项目</Button>
                          <Popconfirm title="确定删除项目？此操作不可恢复。" onConfirm={() => handleDeleteProject(proj.id)}>
                            <Button type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      </div>
                    </div>
                  }
                >
                  {pendingTasks.length > 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong style={{ color: '#9a3412' }}><AlertOutlined /> 您有 {pendingTasks.length} 个待整理任务</Text>
                          <Button size="small" onClick={() => setCurrentView('inbox')}>去整理</Button>
                        </div>
                        <Space wrap>
                          {pendingTasks.map(t => <Tag key={t.id}>{t.title}</Tag>)}
                        </Space>
                      </Space>
                    </div>
                  )}

                  <Table 
                    size="middle"
                    pagination={false}
                    dataSource={activeTasks}
                    rowKey="id"
                    locale={{ emptyText: "该项目下暂无已整理的任务。请在“快速收集箱”中将任务转为待办。" }}
                    columns={[
                      { title: '任务内容', dataIndex: 'title', key: 'title', render: t => <Text style={{ fontWeight: 500 }}>{t}</Text> },
                      { 
                        title: '状态', 
                        dataIndex: 'status', 
                        width: 150,
                        render: (s, record) => (
                          <Select size="small" value={s} onChange={v => handleChangeStatus(record.id, v)} style={{ width: '100%' }}>
                            <Select.Option value="todo">待办</Select.Option>
                            <Select.Option value="doing">进行中</Select.Option>
                            <Select.Option value="done">已完成</Select.Option>
                          </Select>
                        )
                      },
                      { title: '最后更新', dataIndex: 'updated_at', width: 180, render: t => <Text type="secondary" style={{ fontSize: 13 }}>{t}</Text> },
                      { width: 100, render: (_, r) => (
                        <Space>
                          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditTask(r)} />
                          <Popconfirm title="确定删除任务？" onConfirm={() => handleDeleteTask(r.id)}>
                            <Button type="text" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </Space>
                      )}
                    ]}
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  };

  const renderKnowledge = () => {
    const knowledgeItems = personalTasks.filter(t => t.task_type === 'knowledge');
    return (
      <div style={{ padding: '40px 32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>📖 个人知识库</Title>
            <Text type="secondary">记录长久有效的技术路径、配置和知识点</Text>
          </div>
          <Space>
            <Input 
              prefix={<SearchOutlined />} 
              placeholder="搜索知识点..." 
              style={{ width: 300, borderRadius: 20 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <Button ghost icon={<FileExcelOutlined />} onClick={() => handleExport({ taskType: 'knowledge' })}>导出知识库</Button>
          </Space>
        </div>
        <Divider style={{ margin: '24px 0 40px' }} />
        {knowledgeItems.length === 0 && <Empty description="暂无符合条件的知识点" />}
        <Row gutter={[24, 24]}>
          {knowledgeItems.map(t => (
            <Col xs={24} sm={12} md={8} key={t.id}>
              <Card 
                title={<Space wrap><BookOutlined style={{ color: '#f59e0b' }} />{t.title}</Space>} 
                hoverable
                bodyStyle={{ padding: 16 }}
                extra={
                  <Space>
                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEditTask(t)} />
                    <Button type="text" icon={<CopyOutlined />} onClick={() => copyToClipboard(t.content || t.title, "内容")} />
                  </Space>
                }
              >
                <pre>
                  {t.content || '无内容记录'}
                </pre>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>记录于 {t.created_at.split(' ')[0]}</Text>
                  <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTask(t.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        components: {
          Card: {
            headerBg: '#ffffff',
          },
          Layout: {
            siderBg: '#ffffff',
          }
        }
      }}
    >
      <Layout style={{ minHeight: "100vh" }}>
        <Sider theme="light" width={260} style={{ borderRight: '1px solid #f1f5f9' }}>
          <div style={{ height: 80, padding: '0 24px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 32, height: 32, background: '#1890ff', borderRadius: 8, marginRight: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SyncOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
            <Title level={4} style={{ margin: 0, letterSpacing: '-0.5px' }}>备忘录Auto</Title>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[currentView]}
            onClick={(e) => setCurrentView(e.key)}
            style={{ borderRight: 'none' }}
            items={[
              { key: "inbox", icon: <InboxOutlined />, label: "快速收集箱" },
              { 
                key: "work_grp", 
                label: "工作模块", 
                type: 'group',
                children: [
                  { key: "projects", icon: <SolutionOutlined />, label: "项目中心" },
                  { key: "work_timeline", icon: <HistoryOutlined />, label: "最近动态" },
                ]
              },
              { 
                key: "personal_grp", 
                label: "个人模块", 
                type: 'group',
                children: [
                  { key: "knowledge", icon: <BookOutlined />, label: "知识库" },
                  { key: "accounts", icon: <KeyOutlined />, label: "账号管理" },
                ]
              },
            ]}
          />
          <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}>
            <Card size="small" style={{ background: '#f8fafc', border: 'none' }}>
              <Space direction="vertical" size={4}>
                <Text style={{ fontSize: 12 }} type="secondary">当前版本</Text>
                <Text strong style={{ fontSize: 13 }}>v1.0.5 Stable</Text>
              </Space>
            </Card>
          </div>
        </Sider>
        <Layout>
          <Content style={{ background: "#f8fafc", height: '100vh', overflowY: 'auto' }}>
            {currentView === "inbox" && renderInbox()}
            {currentView === "projects" && renderProjectCenter()}
            {currentView === "knowledge" && renderKnowledge()}
            {currentView === "accounts" && <AccountsView accounts={accounts} loadAccounts={loadAccounts} handleExport={handleExportAccounts} />}
            {currentView === "work_timeline" && <TimelineView tasks={workTasks} handleExport={() => handleExport({ category: 'work' })} />}
          </Content>
        </Layout>
      </Layout>

      {/* Edit Task Modal */}
      <Modal
        title="编辑条目"
        open={!!editingTask}
        onCancel={() => setEditingTask(null)}
        onOk={() => editForm.submit()}
        width={600}
        okText="保存更改"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateTask} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <TextArea rows={5} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="category" label="模块" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="personal">个人</Select.Option>
                  <Select.Option value="work">工作</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="taskType" label="类型" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="memo">便笺</Select.Option>
                  <Select.Option value="task">任务</Select.Option>
                  <Select.Option value="knowledge">知识</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                <Select>
                  <Select.Option value="inbox">收集箱</Select.Option>
                  <Select.Option value="todo">待办</Select.Option>
                  <Select.Option value="doing">进行中</Select.Option>
                  <Select.Option value="done">已完成</Select.Option>
                  <Select.Option value="fixed">永久(知识)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="projectName" label="关联项目">
            <Select allowClear showSearch>
              {allProjects.map(p => <Select.Option key={p.id} value={p.name}>{p.name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* New Project Modal */}
      <Modal
        title="新建工作项目"
        open={isProjectModalOpen}
        onCancel={() => setIsProjectModalOpen(false)}
        onOk={() => projectForm.submit()}
        okText="创建项目"
      >
        <Form form={projectForm} layout="vertical" onFinish={handleAddProject} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如：XX系统重构" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <TextArea rows={3} placeholder="简要描述项目的目标和范围..." />
          </Form.Item>
        </Form>
      </Modal>
    </ConfigProvider>
  );
};

// --- Sub Components ---

const AccountsView = ({ accounts, loadAccounts, handleExport }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleAdd = async (values) => {
    try {
      await invoke("add_account", { ...values, note: null });
      message.success("添加成功");
      setIsModalOpen(false);
      form.resetFields();
      loadAccounts();
    } catch (err) { message.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      await invoke("delete_account", { id });
      loadAccounts();
    } catch (err) { message.error(err); }
  };

  return (
    <div style={{ padding: '40px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>🔑 账号管理</Title>
          <Text type="secondary">安全存储您的平台凭据</Text>
        </div>
        <Space>
          <Button ghost icon={<FileExcelOutlined />} onClick={handleExport}>导出账号</Button>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>新增账号</Button>
        </Space>
      </div>
      <Row gutter={[20, 20]}>
        {accounts.map(acc => (
          <Col xs={24} sm={12} md={8} key={acc.id}>
            <Card 
              title={<Text strong>{acc.platform}</Text>} 
              extra={<Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleDelete(acc.id)} />}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>用户名/邮箱</Text>
                <Text strong style={{ fontSize: 16 }}>{acc.username}</Text>
              </div>
              <Space split={<Divider type="vertical" />}>
                <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => { navigator.clipboard.writeText(acc.username); message.success("用户名已复制"); }}>复制 ID</Button>
                <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => { navigator.clipboard.writeText(acc.password); message.success("密码已复制"); }}>复制密码</Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <Modal 
        title="新增账号凭据" 
        open={isModalOpen} 
        onCancel={() => setIsModalOpen(false)} 
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleAdd} style={{ marginTop: 16 }}>
          <Form.Item name="platform" label="平台" rules={[{required: true}]}><Input placeholder="GitHub, AWS, Vultr..." /></Form.Item>
          <Form.Item name="username" label="用户名/邮箱" rules={[{required: true}]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{required: true}]}><Input.Password /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const TimelineView = ({ tasks, handleExport }) => (
  <div style={{ padding: '40px 32px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <div>
        <Title level={2} style={{ margin: 0 }}>🕒 最近动态</Title>
        <Text type="secondary">追踪所有工作任务的操作历史</Text>
      </div>
      <Button ghost icon={<FileExcelOutlined />} onClick={handleExport}>导出动态</Button>
    </div>
    <Divider style={{ margin: '24px 0 40px' }} />
    <Timeline mode="left">
      {tasks.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at)).map(t => (
        <Timeline.Item 
          key={t.id} 
          label={<Text type="secondary" style={{ fontSize: 12 }}>{t.updated_at}</Text>} 
          color={t.status === 'done' ? 'green' : t.status === 'doing' ? 'blue' : 'gray'}
        >
          <Card size="small" style={{ borderRadius: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: t.status === 'done' ? '#22c55e' : '#3b82f6' }} />
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 14 }}>{t.title}</Text>
                <div style={{ marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>项目: {t.project_name || '通用'}</Text>
                  <Divider type="vertical" />
                  <Tag bordered={false} size="small">{t.status.toUpperCase()}</Tag>
                </div>
              </div>
            </div>
          </Card>
        </Timeline.Item>
      ))}
    </Timeline>
  </div>
);

export default App;
