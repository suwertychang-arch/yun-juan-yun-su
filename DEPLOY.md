# 云卷云苏 - 部署指南

## 架构说明

- 前端：纯 HTML/CSS/JS，无需构建
- 后端：Node.js + Express
- AI：DeepSeek V4 Pro API（服务端配置，用户无需设置）
- 房间同步：HTTP 轮询（每2秒），非 WebSocket

## 部署步骤（Railway）

### 1. 注册 GitHub 账号
- 打开 [github.com](https://github.com)，点击 Sign up
- 填写用户名、邮箱、密码，完成注册

### 2. 在 GitHub 上创建仓库
- 登录后点击右上角 `+` → New repository
- 仓库名填 `yun-juan-yun-su`
- 选择 Public（公开）
- 不要勾选任何初始化选项
- 点击 Create repository

### 3. 安装 Git
- 打开 [git-scm.com](https://git-scm.com/)，下载 Windows 版
- 安装时一路 Next 即可，不用改任何设置

### 4. 下载项目文件
从压缩包解压以下文件到电脑新建的文件夹 `yun-juan-yun-su`：

```
yun-juan-yun-su/
├── server.js
├── package.json
├── Dockerfile
├── .dockerignore
├── .gitignore
└── public/
    └── index.html
```

注意：`public` 是子文件夹，`index.html` 放在 `public` 里面。

### 5. 上传代码到 GitHub
在 `yun-juan-yun-su` 文件夹里右键 → Open Git Bash Here，执行：

```bash
git init
git add -A
git commit -m "云卷云苏上线"
git branch -M main
git remote add origin https://github.com/你的用户名/yun-juan-yun-su.git
git push -u origin main
```

如果推送失败（网络问题）：
- 确保代理软件已开启全局模式
- 或执行：`git config --global http.proxy http://127.0.0.1:你的代理端口`
- 再重新推送：`git push -u origin main`

如果提示输入密码，需要用 GitHub Personal Access Token（不是账号密码）：
- GitHub → Settings → Developer settings → Personal access tokens → Generate new token
- 勾选 `repo` 权限，生成后复制 token，粘贴到终端

### 6. 用 Railway 部署
1. 打开 [railway.app](https://railway.app/)，点 Login，选 GitHub 登录
2. 点击 New Project → Deploy from GitHub repo
3. 选择你刚创建的 `yun-juan-yun-su` 仓库
4. Railway 会自动识别 Dockerfile 并开始部署
5. 等待 1-2 分钟，状态变成绿色就说明部署成功

### 7. 配置环境变量（关键步骤）
1. 在 Railway 项目页面点击你的 Service
2. 点击 Settings 标签页
3. 找到 Environment Variables 区域
4. 添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `AI_API_KEY` | 你的 DeepSeek API Key（sk-xxx） |
| `AI_BASE_URL` | `https://api.deepseek.com` |
| `AI_MODEL` | `deepseek-v4-pro` |

5. DeepSeek API Key 获取：去 [platform.deepseek.com](https://platform.deepseek.com/) 注册，在 API Keys 页面创建

### 8. 生成公网地址
1. 在 Railway 的 Settings 标签页
2. 找到 Networking / Domains 区域
3. 点击 Generate Domain
4. 得到一个公网地址，比如 `yun-juan-yun-su.up.railway.app`
5. 手机浏览器打开这个地址就能用了

### 9. 使用
1. 打开公网地址，输入4位房间号，选男生/女生
2. 点 🔗 复制链接，发给对方
3. 对方打开链接，输入同样的房间号，选另一个身份
4. 发起方选场景+写倾诉，被邀请方选状态+可选补充
5. 点「请导师回应」，导师给出共同解读（双方可见）+ 给你的话（仅自己可见）

## 常见问题

**Q: git push 报错 Failed to connect to github.com**
A: 国内网络问题，需要开启代理软件的全局模式，或设置 Git 代理：
```bash
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

**Q: git push 报错 src refspec main does not match any**
A: 没有提交代码，先执行 `git add -A` 和 `git commit -m "xxx"`

**Q: Railway 部署失败**
A: 检查 Dockerfile 是否有 `.txt` 后缀（Windows 会自动加），如果有需要重命名去掉

**Q: 导师回应报错**
A: 检查 Railway 的 Environment Variables 里 `AI_API_KEY` 是否正确设置

**Q: 两个人进同一个房间但看不到对方在线**
A: 确保两人输入的房间号完全一致，且都点了「进入房间」。在线状态靠心跳判断，等2-3秒就会更新
