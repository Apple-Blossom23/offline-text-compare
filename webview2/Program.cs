using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Text Compare WebView2")]
[assembly: AssemblyDescription("离线文本对比 · 系统 WebView2 内核")]
[assembly: AssemblyProduct("Text Compare WebView2")]
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: AssemblyFileVersion("1.1.0.0")]

namespace TextCompare {
    internal static class Program {
        internal const string Title = "Text Compare · WebView2 离线版";
        internal static readonly string DataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TextCompareWebView2");
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string className, string windowName);
        [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr handle, int command);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr handle);
        [DllImport("user32.dll")] static extern bool IsIconic(IntPtr handle);
        [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

        [STAThread]
        static void Main() {
            bool created;
            using (var mutex = new Mutex(true, "Local\\TextCompareWebView2.v1", out created)) {
                if (!created) { var existing = FindWindow(null, Title); if (existing != IntPtr.Zero) { if (IsIconic(existing)) ShowWindow(existing, 9); SetForegroundWindow(existing); } return; }
                SetProcessDPIAware();
                Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
                Directory.CreateDirectory(DataDir);
                try {
                    string version = CoreWebView2Environment.GetAvailableBrowserVersionString();
                    Log("runtime " + version);
                    Application.Run(new CompareWindow());
                } catch (WebView2RuntimeNotFoundException) {
                    MessageBox.Show("未检测到 Microsoft Edge WebView2 Runtime。\n\n请先安装微软 WebView2 Evergreen Runtime，再重新启动。应用不会自动联网安装。\n下载地址见随包使用说明。", Title, MessageBoxButtons.OK, MessageBoxIcon.Information);
                } catch (Exception) {
                    Log("startup-failed");
                    MessageBox.Show("应用未能启动。请完整解压程序目录，并确认已安装 .NET Framework 4.8 和 WebView2 Runtime。", Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }
        internal static void Log(string value) { try { File.AppendAllText(Path.Combine(DataDir, "desktop.log"), DateTime.UtcNow.ToString("o") + " " + value + Environment.NewLine); } catch {} }
        internal static string Resource(string name) { using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) using (var reader = new StreamReader(stream, Encoding.UTF8)) return reader.ReadToEnd(); }
    }

    internal sealed class CompareWindow : Form {
        readonly WebView2 view = new WebView2();
        readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 64000000, RecursionLimit = 32 };
        bool ready, saveDialogOpen;
        public CompareWindow() {
            Text = Program.Title; MinimumSize = new Size(800, 600); StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(Math.Min(1360, Screen.PrimaryScreen.WorkingArea.Width - 40), Math.Min(960, Screen.PrimaryScreen.WorkingArea.Height - 40));
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            LoadBounds();
            var menu = new MenuStrip();
            var file = new ToolStripMenuItem("文件");
            AddItem(file, "导入原始文本…", Keys.Control | Keys.O, delegate { SendAction("import-left"); });
            AddItem(file, "导入修改后文本…", Keys.Control | Keys.Shift | Keys.O, delegate { SendAction("import-right"); });
            file.DropDownItems.Add(new ToolStripSeparator());
            AddItem(file, "导出对比报告…", Keys.Control | Keys.Shift | Keys.S, delegate { SendAction("export"); });
            file.DropDownItems.Add(new ToolStripSeparator());
            AddItem(file, "退出", Keys.Alt | Keys.F4, delegate { Close(); });
            var display = new ToolStripMenuItem("查看");
            AddItem(display, "放大", Keys.Control | Keys.Oemplus, delegate { view.ZoomFactor = Math.Min(2.0, view.ZoomFactor + 0.1); });
            AddItem(display, "缩小", Keys.Control | Keys.OemMinus, delegate { view.ZoomFactor = Math.Max(0.5, view.ZoomFactor - 0.1); });
            AddItem(display, "重置缩放", Keys.Control | Keys.D0, delegate { view.ZoomFactor = 1.0; });
            var help = new ToolStripMenuItem("帮助");
            AddItem(help, "使用帮助", Keys.F1, delegate { SendAction("help"); });
            AddItem(help, "关于 Text Compare", Keys.None, delegate { MessageBox.Show(this, "Text Compare 1.1.0\n\n复用系统 Microsoft Edge WebView2 内核\n文本仅在本机处理，不启动服务器。", "关于 Text Compare", MessageBoxButtons.OK, MessageBoxIcon.Information); });
            menu.Items.AddRange(new ToolStripItem[] { file, display, help });
            view.Dock = DockStyle.Fill;
            Controls.Add(view); Controls.Add(menu); MainMenuStrip = menu;
            Shown += async delegate { await InitializeWebView(); };
            FormClosing += delegate { SaveBounds(); view.Dispose(); };
        }
        static void AddItem(ToolStripMenuItem menu, string text, Keys shortcut, EventHandler handler) {
            var item = new ToolStripMenuItem(text) { ShortcutKeys = shortcut }; item.Click += handler; menu.DropDownItems.Add(item);
        }
        void SendAction(string name) { if (ready && Policy.IsAppUrl(view.CoreWebView2.Source)) view.CoreWebView2.PostWebMessageAsJson(json.Serialize(new { type = "action", name = name })); }
        async System.Threading.Tasks.Task InitializeWebView() {
            try {
                var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.DataDir, "Profile"), null);
                await view.EnsureCoreWebView2Async(environment);
                var core = view.CoreWebView2;
                core.Settings.AreHostObjectsAllowed = false;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsGeneralAutofillEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) { e.Cancel = !Policy.IsAppUrl(e.Uri); };
                core.FrameNavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) { e.Cancel = true; };
                core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
                core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs e) { e.State = CoreWebView2PermissionState.Deny; };
                core.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs e) { e.Cancel = true; };
                core.ProcessFailed += delegate { Program.Log("renderer-process-failed"); };
                byte[] html = Encoding.UTF8.GetBytes(Program.Resource("TextCompare.index.html"));
                core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All, CoreWebView2WebResourceRequestSourceKinds.All);
                core.WebResourceRequested += delegate(object sender, CoreWebView2WebResourceRequestedEventArgs e) {
                    if (Policy.IsAppUrl(e.Request.Uri)) e.Response = environment.CreateWebResourceResponse(new MemoryStream(html, false), 200, "OK", "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store");
                    else e.Response = environment.CreateWebResourceResponse(new MemoryStream(new byte[0]), 403, "Blocked", "Content-Type: text/plain");
                };
                core.WebMessageReceived += ReceiveMessage;
                await core.AddScriptToExecuteOnDocumentCreatedAsync(Program.Resource("TextCompare.bridge.js"));
                core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs e) { ready = e.IsSuccess; Program.Log(ready ? "window-ready" : "page-load-failed"); };
                core.Navigate(Policy.AppUrl);
            } catch (Exception) {
                Program.Log("webview-initialization-failed");
                MessageBox.Show(this, "WebView2 初始化失败，请检查运行时是否安装完整，或尝试重新启动应用。", Program.Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }
        async void ReceiveMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e) {
            if (!Policy.IsAppUrl(e.Source) || !Policy.IsAppUrl(view.CoreWebView2.Source)) return;
            int id = 0;
            try {
                if (e.WebMessageAsJson.Length > 64000000) return;
                var message = json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson);
                if (message == null || !message.ContainsKey("type") || !message.ContainsKey("id")) return;
                id = Convert.ToInt32(message["id"]);
                if (id <= 0) return;
                if (Object.Equals(message["type"], "open-file")) {
                    if (saveDialogOpen) { Reply(id, true, null); return; }
                    saveDialogOpen = true;
                    try {
                        using (var picker = new OpenFileDialog { Title = "导入纯文本文件", Filter = "纯文本与代码|*.txt;*.json;*.md;*.csv;*.log;*.py;*.js;*.ts;*.xml;*.yml;*.yaml;*.ini;*.css;*.html|所有文件|*.*", CheckFileExists = true, Multiselect = false }) {
                            if (picker.ShowDialog(this) != DialogResult.OK) { Reply(id, true, null); return; }
                            if (new FileInfo(picker.FileName).Length > 5 * 1024 * 1024) { Reply(id, false, "文件不能超过 5 MB。"); return; }
                            byte[] bytes = File.ReadAllBytes(picker.FileName);
                            if (bytes.Length > 5 * 1024 * 1024) { Reply(id, false, "文件不能超过 5 MB。"); return; }
                            if (Policy.IsAppUrl(view.CoreWebView2.Source)) view.CoreWebView2.PostWebMessageAsJson(json.Serialize(new { type = "reply", id = id, canceled = false, filename = Path.GetFileName(picker.FileName), base64 = Convert.ToBase64String(bytes) }));
                            Program.Log("file-imported");
                        }
                    } finally { saveDialogOpen = false; }
                    return;
                }
                if (!Object.Equals(message["type"], "save-report")) return;
                string html = message.ContainsKey("html") ? message["html"] as string : null;
                string filename = message.ContainsKey("filename") ? message["filename"] as string : null;
                if (id <= 0 || !Policy.IsValidReport(html, filename) || saveDialogOpen) { Reply(id, false, "无效的导出请求，或已有保存窗口打开。"); return; }
                saveDialogOpen = true;
                try {
                    using (var dialog = new SaveFileDialog { Title = "导出文本对比报告", FileName = filename, Filter = "HTML 对比报告|*.html", DefaultExt = "html", AddExtension = true, OverwritePrompt = true, InitialDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments) }) {
                        if (dialog.ShowDialog(this) != DialogResult.OK) { Reply(id, true, null); return; }
                        using (var writer = new StreamWriter(dialog.FileName, false, new UTF8Encoding(false))) await writer.WriteAsync(html);
                        Reply(id, false, null); Program.Log("report-saved");
                    }
                } finally { saveDialogOpen = false; }
            } catch { Program.Log("report-save-failed"); if (id > 0) Reply(id, false, "报告保存失败，请检查文件夹权限。"); }
        }
        void Reply(int id, bool canceled, string error) { if (!view.IsDisposed && Policy.IsAppUrl(view.CoreWebView2.Source)) view.CoreWebView2.PostWebMessageAsJson(json.Serialize(new { type = "reply", id = id, canceled = canceled, error = error })); }
        void LoadBounds() {
            try {
                var data = json.Deserialize<Dictionary<string, int>>(File.ReadAllText(Path.Combine(Program.DataDir, "window.json")));
                var rect = new Rectangle(data["x"], data["y"], data["width"], data["height"]);
                if (rect.Width >= 800 && rect.Height >= 600 && Array.Exists(Screen.AllScreens, s => s.WorkingArea.Contains(new Point(rect.X + 100, rect.Y + 100)))) { StartPosition = FormStartPosition.Manual; Bounds = rect; }
                if (data.ContainsKey("maximized") && data["maximized"] == 1) WindowState = FormWindowState.Maximized;
            } catch {}
        }
        void SaveBounds() {
            try { var bounds = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds; File.WriteAllText(Path.Combine(Program.DataDir, "window.json"), json.Serialize(new { x = bounds.X, y = bounds.Y, width = bounds.Width, height = bounds.Height, maximized = WindowState == FormWindowState.Maximized ? 1 : 0 })); } catch {}
        }
    }
}
