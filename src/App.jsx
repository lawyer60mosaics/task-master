import React, { useState, useEffect } from "react";
import { 
  Layout, Menu, Button, Input, Select, Card, Tag, 
  Space, Modal, Form, Table, Timeline, message, 
  Popconfirm, Typography, Divider, Row, Col 
} from "antd";
import { 
  InboxOutlined, 
  ProjectOutlined, 
  HistoryOutlined, 
  KeyOutlined, 
  DeleteOutlined, 
  PlusOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";

const { Header, Sider, Content } = Layout;
const { TextArea } = Input;
const { Title, Text } = Typography;

const App = () => {
  const [currentView, setCurrentView] = useState("inbox");
  const [allTasks, setAllTasks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [projectFilter, setProjectFilter] = useState(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountForm] = Form.useForm();
  const [inboxText, setInboxText] = useState("");
  const [inboxProject, setInboxProject] = useState(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      const tasks = await invoke("get_tasks");
      setAllTasks(tasks);
    } catch (err) {
      message.error("获取数据失败: " + err);
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
    if (!inboxText.trim()) return;
    try {
      await invoke("add_task", {
        title: inboxText,
        taskType: "memo",
        status: "inbox",
        priority: "medium",
        projectName: inboxProject || null,
      });
      setInboxText("");
      message.success("已添加到收集箱");
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

  const handleAddAccount = async (values) => {
    try {
      await invoke("add_account", { ...values, note: null });
      message.success("账号已添加");
      setIsAccountModalOpen(false);
      accountForm.resetFields();
      loadAccounts();
    } catch (err) {
      message.error("添加失败: " + err);
    }
  };

  const handleDeleteAccount = async (id) => {
    try {
      await invoke("delete_account", { id });
      message.success("已删除");
      loadAccounts();
    } catch (err) {
      message.error("删除失败: " + err);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} 已复制到剪贴板`);
  };

  // --- Render Helpers ---
  const projects = [...new Set(allTasks.map((t) => t.project_name).filter((p) => p))];

  const filteredTasks = projectFilter
    ? allTasks.filter((t) => t.project_name === projectFilter)
    : allTasks;

  const renderInbox = () => (
    <div style={{ padding: 24 }}>
      <Title level={2}>📥 收集箱</Title>
      <Card style={{ marginBottom: 24 }}>
        <TextArea
          rows={4}
          placeholder="输入灵感或待办..."
          value={inboxText}
          onChange={(e) => setInboxText(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <Space>
          <Select
            placeholder="项目标记"
            style={{ width: 200 }}
            allowClear
            value={inboxProject}
            onChange={setInboxProject}
          >
            {projects.map((p) => (
              <Select.Option key={p} value={p}>
                {p}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" onClick={handleAddTask}>
            收集
          </Button>
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        {allTasks
          .filter((t) => t.status === "inbox")
          .map((t) => (
            <Col xs={24} sm={12} md={8} key={t.id}>
              <Card
                size="small"
                title={t.title}
                extra={
                  <Space>
                    <Button size="small" onClick={() => handleChangeStatus(t.id, "todo")}>
                      转为任务
                    </Button>
                    <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTask(t.id)}>
                      <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                  </Space>
                }
              >
                {t.project_name && <Tag color="blue">#{t.project_name}</Tag>}
              </Card>
            </Col>
          ))}
      </Row>
    </div>
  );

  const renderKanban = () => {
    const statuses = [
      { key: "todo", title: "待办", color: "#108ee9", icon: <ClockCircleOutlined /> },
      { key: "doing", title: "进行中", color: "#faad14", icon: <SyncOutlined spin /> },
      { key: "done", title: "已完成", color: "#52c41a", icon: <CheckCircleOutlined /> },
    ];

    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>📋 任务看板</Title>
          <Text type="secondary">{projectFilter ? `项目: ${projectFilter}` : "所有项目"}</Text>
        </div>
        <Row gutter={16}>
          {statuses.map((s) => (
            <Col span={8} key={s.key}>
              <Card
                title={
                  <span>
                    {s.icon} {s.title}
                  </span>
                }
                headStyle={{ backgroundColor: s.color + "11", borderTop: `3px solid ${s.color}` }}
                bodyStyle={{ backgroundColor: "#f5f5f5", minHeight: "60vh" }}
              >
                {filteredTasks
                  .filter((t) => t.status === s.key)
                  .map((t) => (
                    <Card size="small" style={{ marginBottom: 12 }} key={t.id}>
                      <div style={{ marginBottom: 8 }}>{t.title}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Select
                          size="small"
                          value={t.status}
                          onChange={(val) => handleChangeStatus(t.id, val)}
                          style={{ width: 100 }}
                        >
                          <Select.Option value="todo">待办</Select.Option>
                          <Select.Option value="doing">进行中</Select.Option>
                          <Select.Option value="done">已完成</Select.Option>
                        </Select>
                        <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTask(t.id)}>
                          <Button size="small" type="text" icon={<DeleteOutlined />} danger />
                        </Popconfirm>
                      </div>
                    </Card>
                  ))}
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  const renderTimeline = () => (
    <div style={{ padding: 24 }}>
      <Title level={2}>🕒 活动流</Title>
      <Timeline
        mode="left"
        items={allTasks
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .map((t) => ({
            label: t.updated_at,
            children: (
              <Card size="small">
                <Text strong>[{t.status.toUpperCase()}]</Text> {t.title}
              </Card>
            ),
            color: t.status === "done" ? "green" : t.status === "doing" ? "blue" : "gray",
          }))}
      />
    </div>
  );

  const renderAccounts = () => (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <Title level={2}>🔑 账号管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAccountModalOpen(true)}>
          添加账号
        </Button>
      </div>
      <Row gutter={[16, 16]}>
        {accounts.map((acc) => (
          <Col xs={24} sm={12} md={8} key={acc.id}>
            <Card
              title={acc.platform}
              extra={
                <Popconfirm title="确定删除账号？" onConfirm={() => handleDeleteAccount(acc.id)}>
                  <Button type="text" icon={<DeleteOutlined />} danger />
                </Popconfirm>
              }
            >
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">用户名: </Text>
                <Text>{acc.username}</Text>
              </div>
              <Space>
                <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(acc.username, "用户名")}>
                  UID
                </Button>
                <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(acc.password, "密码")}>
                  PWD
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="添加账号"
        open={isAccountModalOpen}
        onCancel={() => setIsAccountModalOpen(false)}
        onOk={() => accountForm.submit()}
      >
        <Form form={accountForm} layout="vertical" onFinish={handleAddAccount}>
          <Form.Item name="platform" label="平台" rules={[{ required: true }]}>
            <Input placeholder="如: GitHub, Vultr" />
          </Form.Item>
          <Form.Item name="username" label="用户名/邮箱" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={240}>
        <div style={{ height: 64, padding: 16, display: 'flex', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>备忘录Auto</Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[currentView]}
          onClick={(e) => setCurrentView(e.key)}
          items={[
            { key: "inbox", icon: <InboxOutlined />, label: "收集箱 (Inbox)" },
            { key: "tasks", icon: <ProjectOutlined />, label: "任务流 (Tasks)" },
            { key: "timeline", icon: <HistoryOutlined />, label: "活动流 (Timeline)" },
            { key: "accounts", icon: <KeyOutlined />, label: "账号管理 (Accounts)" },
          ]}
        />
        <Divider orientation="left">项目标记</Divider>
        <Menu
          mode="inline"
          selectedKeys={[projectFilter || "all"]}
          onClick={(e) => setProjectFilter(e.key === "all" ? null : e.key)}
          items={[
            { key: "all", label: "全部任务" },
            ...projects.map((p) => ({ key: p, label: `# ${p}` })),
          ]}
        />
      </Sider>
      <Layout>
        <Content style={{ background: "#fff" }}>
          {currentView === "inbox" && renderInbox()}
          {currentView === "tasks" && renderKanban()}
          {currentView === "timeline" && renderTimeline()}
          {currentView === "accounts" && renderAccounts()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default App;
