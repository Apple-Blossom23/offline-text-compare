# Text Compare · 离线文本对比

一个轻量的 Windows 文本对比桌面应用。**复用系统 WebView2 浏览器内核，文本在本机处理，无需账号、服务器或订阅。**

[下载 Windows x64 版](https://github.com/Apple-Blossom23/offline-text-compare/releases/latest) · [提交问题](https://github.com/Apple-Blossom23/offline-text-compare/issues) · [MIT License](LICENSE)

<img width="1901" height="1140" alt="image" src="https://github.com/user-attachments/assets/7bfe84e2-c302-4b2e-a78c-9a587336105b" />


适合快速核对提示词、JSON 配置、代码片段、日志和 Markdown 文档，粘贴两段文本即可查看差异。

## 为什么选择它

| 优势 | 实际带来的便利 |
| --- | --- |
| **下载包约 0.3 MiB** | 复用系统已有的 WebView2 Runtime，不在每个应用中再附带一份浏览器内核，方便保存和分发。 |
| **本地离线处理** | 文本比较在本机执行，应用没有文本上传接口、账号系统或遥测代码。运行组件齐备后无需联网使用。 |
| **原生桌面体验** | 独立窗口、Windows 文件选择与另存为、菜单快捷键、窗口位置记忆及单实例启动。 |
| **变化清楚可见** | 左右并排、行号、增删改统计、修改行的字符高亮，以及上一处 / 下一处差异导航。 |
| **照顾中文文件** | 支持 UTF-8、GBK / GB18030、UTF-16 LE / BE；带 BOM 的 UTF-16 文件自动识别。 |
| **便于审阅和分享** | 可只看差异、忽略空白或大小写，支持 JSON 格式化；导出独立 HTML 报告，可离线查看和打印。 |
| **源码简洁** | C# + WinForms + 原生 HTML/CSS/JavaScript；前端、构建及 Node 测试没有 npm 包依赖。 |


## 下载与运行

1. 从 [Releases](https://github.com/Apple-Blossom23/offline-text-compare/releases/latest) 下载 `TextCompare-WebView2-Windows-x64.zip`。
2. 完整解压到一个文件夹。
3. 双击 `TextCompare.exe`。请保留同目录的 DLL、配置和许可文件，不能只复制 EXE。

可选：双击随包的 `创建桌面快捷方式.vbs` 创建桌面入口。

### 系统要求

- Windows 10 / 11，x64。
- [.NET Framework 4.8](https://dotnet.microsoft.com/download/dotnet-framework/net48) 或兼容的后续版本。
- [Microsoft Edge WebView2 Evergreen Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。安装 Edge 浏览器不等同于一定已有可用的 WebView2 Runtime。

程序缺少 WebView2 时会给出提示，不会自动下载。完全离线部署前，请提前准备微软官方运行组件的离线安装包。发行版为**未签名便携版**，不需要安装开发工具；下载的程序可能显示 Windows 的发布者提示。

## 使用方法

1. 在左右两侧粘贴原始文本和修改后文本，或导入纯文本文件。
2. 默认自动比较；也可关闭“实时对比”，按“开始对比”。
3. 红色表示删除，绿色表示新增；修改行会高亮变化字符。
4. 使用差异导航定位改动，可切换“只看差异”、自动换行、浅色 / 深色主题。
5. 点击“导出报告”，在 Windows 另存为窗口中选择位置，得到独立的 HTML 文件。报告可用浏览器打开，也可打印为 PDF。

支持交换左右文本、JSON 格式化和可选的本地文本保留。JSON 格式化保留键顺序，不做语义层面的 JSON 比较。

| 快捷键 | 操作 |
| --- | --- |
| `Ctrl + Enter` | 开始比较 |
| `Ctrl + O` | 导入左侧文件 |
| `Ctrl + Shift + O` | 导入右侧文件 |
| `Ctrl + Shift + S` | 导出 HTML 报告 |
| `Alt + ↑ / ↓` | 输入区外跳转差异 |
| `Ctrl + + / - / 0` | 放大 / 缩小 / 重置缩放 |
| `F1` | 使用帮助 |

## 隐私与本地数据

- 应用不启动本地 HTTP 服务器。内嵌界面通过 WebView2 请求拦截直接返回，页面 CSP 禁止网络连接，外部页面导航和资源请求被应用拦截。
- 应用没有遥测、登录、云同步和自动更新功能；文本不发送到应用服务器。WebView2 Runtime 自身的系统维护与更新由微软组件负责。
- 默认不保留输入文本。主动勾选保留后，文本存储在当前 Windows 用户的本地应用数据中；这不是加密存储，也不应作为唯一备份。
- 数据、设置及 WebView2 Profile 位于 `%LOCALAPPDATA%\TextCompareWebView2`。日志仅记录运行时版本和通用事件，不记录导入文本或报告正文。
- 取消勾选保留或点击“清空”会删除应用保留的文本。需要彻底清理配置和缓存时，可在退出应用后删除上述数据目录。
- 导出报告包含被比较的原始文本，分享前请自行确认内容。

## 对比规则与边界

- 以行为单位进行对齐，修改行再做字符高亮。连续的变更归为一处差异。
- CRLF、CR、LF 统一为 LF；末尾换行、空白行和行顺序参与比较。
- “忽略所有空白”忽略每行内部空格、制表符等空白字符，不删除空白行。“忽略大小写”使用 Unicode 小写转换。
- 字符计数使用 JavaScript UTF-16 长度，部分表情计为两个单位；行内高亮按 Unicode 码点处理。
- 支持 TXT、JSON、代码、Markdown、日志等纯文本；不解析 Word、PDF、Excel，不进行文件夹或二进制文件比较。
- 单文件最多 **5 MiB**；每侧最多 **200 万字符、10 万行**。乱码时选择正确编码后重新导入。
- 比较在 Web Worker 中执行，结果每页显示 400 行。差异过多时会提示并采用整段对齐，超长修改行可能整行高亮。该工具不做语义理解或自动合并。

## 从源码构建

需要 Windows x64、Node.js 20+，以及上述 .NET / WebView2 运行组件。构建使用 Windows 自带的 .NET Framework C# 编译器，无需安装 .NET SDK 或 Electron。

```powershell
git clone https://github.com/Apple-Blossom23/offline-text-compare.git
cd offline-text-compare
npm test
npm run desktop:package
```

**不需要 `npm install` 或 `npm ci`。** 首次桌面构建从 NuGet 下载固定版本 `Microsoft.Web.WebView2 1.0.4258.31` 并校验 SHA-256；后续使用本地缓存。下载缓存位于 `.webview2-build/`。准备完全离线构建时，可预先放入与构建脚本校验值一致的 `microsoft.web.webview2.1.0.4258.31.nupkg`。

输出：

```text
release/TextCompare-WebView2-win-x64/TextCompare.exe
release/TextCompare-WebView2-Windows-x64.zip
```

其他命令：

```powershell
npm run build   # 生成独立 index.html，也可用新版 Edge / Chrome 打开
npm run desktop # 启动已构建的 Windows 版；首次运行会先构建
```

### 项目结构

```text
assets/icon.ico        应用图标
src/                   HTML / CSS / JavaScript 源码与差异算法
webview2/              C# 桌面外壳、桥接、构建脚本及原生策略测试
test/                  Node 回归与合成测试文件
docs/                  界面截图和验证说明
build.mjs              单文件 HTML 构建脚本
index.html             生成的离线单文件界面
```

## 验证与反馈

Node 回归覆盖基本差异、换行与忽略规则、中文与表情、2,000 组随机输入、50,000 行输入，以及 WebView2 桥接来源、消息关联和原生文件传输。桌面构建还运行 C# 来源及报告参数校验。

已在本机验证桌面启动、示例比较、中文文件导入、原生 HTML 报告导出和单实例启动。尚未在其他电脑、物理断网环境下完成验证，详见 [验证记录](docs/VERIFICATION.md)。

欢迎通过 [Issues](https://github.com/Apple-Blossom23/offline-text-compare/issues) 报告问题或提交 PR。请提供 Windows / WebView2 版本、复现步骤和可公开的最小文本样例，避免上传真实敏感内容。

## 许可证

本项目源码采用 [MIT License](LICENSE)，允许使用、修改、分发和商用，并需保留许可与版权声明。Microsoft WebView2 组件遵循其自身许可，随 Windows ZIP 提供原始许可文本；参见 [第三方组件说明](THIRD_PARTY_NOTICES.md)。
