# Third-party components

The project's own source code is licensed under the MIT License in `LICENSE`.
Third-party components retain their respective licenses.

## Microsoft WebView2 SDK

- Package: `Microsoft.Web.WebView2` version `1.0.4258.31`.
- Source: https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4258.31
- SDK package SHA-256: `56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9`.
- The Windows distribution contains `Microsoft.Web.WebView2.Core.dll`,
  `Microsoft.Web.WebView2.WinForms.dll`, and the x64 `WebView2Loader.dll`.
- The build copies the SDK's original license to `WebView2-LICENSE.txt` in the
  Windows distribution. The project's MIT License does not relicense these files.

## System prerequisites

Microsoft Edge WebView2 Evergreen Runtime and .NET Framework 4.8 are installed
separately and are not included in this repository or the Windows ZIP. Their
Microsoft license terms apply. The application uses Windows system fonts.

The JavaScript application and its Node.js test/build scripts have no npm package
dependencies. Node.js is used for development only and is not redistributed.
