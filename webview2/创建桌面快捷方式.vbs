Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
Set shortcut = shell.CreateShortcut(shell.SpecialFolders("Desktop") & "\Text Compare WebView2.lnk")
shortcut.TargetPath = root & "\TextCompare.exe"
shortcut.WorkingDirectory = root
shortcut.IconLocation = root & "\TextCompare.exe,0"
shortcut.Save
MsgBox "Desktop shortcut created.", 64, "Text Compare WebView2"
