Option Explicit

' L.REMETTRE Hub Background Auto-Sync & Deploy Daemon Launcher
' Silently launches watch_docs.py via pythonw.exe (window style 0, hidden).
' Duplicate runs exit cleanly thanks to the localhost TCP lock in watch_docs.py.

Dim fso, shell, hubDir, scriptPath, localAppData, pyDir, subFolder, candidate, pyExe, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

hubDir = fso.GetParentFolderName(WScript.ScriptFullName)
scriptPath = fso.BuildPath(hubDir, "watch_docs.py")
shell.CurrentDirectory = hubDir

pyExe = ""
localAppData = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
pyDir = fso.BuildPath(localAppData, "Programs\Python")
If fso.FolderExists(pyDir) Then
    For Each subFolder In fso.GetFolder(pyDir).SubFolders
        candidate = fso.BuildPath(subFolder.Path, "pythonw.exe")
        If fso.FileExists(candidate) Then
            pyExe = """" & candidate & """"
        End If
    Next
End If

If pyExe = "" Then
    pyExe = "pythonw.exe"
End If

cmd = pyExe & " """ & scriptPath & """"
On Error Resume Next
shell.Run cmd, 0, False
If Err.Number <> 0 Then
    Err.Clear
    shell.Run "python.exe """ & scriptPath & """", 0, False
End If
On Error GoTo 0
